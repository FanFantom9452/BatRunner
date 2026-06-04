import * as vscode from 'vscode';
import * as path from 'path';
import { stripAnsi } from './format';
import { RunResult } from './types';

interface ManagedTerminal {
  terminal: vscode.Terminal;
  /** Resolves with the shell integration once active, or undefined on timeout. */
  ready: Promise<vscode.TerminalShellIntegration | undefined>;
  /** Latest run for this terminal's script; updated live as output streams. */
  result?: RunResult;
}

// How long to wait for VS Code to activate shell integration before falling
// back to a plain (uncaptured) run.
const SHELL_INTEGRATION_TIMEOUT_MS = 8000;

export class Runner {
  private terminals = new Map<string, ManagedTerminal>();
  /** The most recently STARTED run, used as a fallback when no terminal/editor
   *  pins a specific script. */
  private lastRun: RunResult | undefined;
  private closeSub: vscode.Disposable;

  constructor() {
    // Drop map entries when the user closes a managed terminal from the UI.
    this.closeSub = vscode.window.onDidCloseTerminal((closed) => {
      for (const [key, entry] of this.terminals) {
        if (entry.terminal === closed) {
          this.terminals.delete(key);
          break;
        }
      }
    });
  }

  getLastRun(): RunResult | undefined {
    return this.lastRun;
  }

  /** The run owned by a specific terminal (e.g. the focused one), if any. */
  getResultForTerminal(terminal: vscode.Terminal): RunResult | undefined {
    for (const entry of this.terminals.values()) {
      if (entry.terminal === terminal) {
        return entry.result;
      }
    }
    return undefined;
  }

  /** The run for a specific script (e.g. the active editor's file), if any. */
  getResultForScript(scriptPath: string): RunResult | undefined {
    return this.terminals.get(scriptPath)?.result;
  }

  // Get (or create) the real terminal for a script. We force powershell.exe
  // because VS Code reliably activates shell integration for it on Windows,
  // which gives us a real TTY (so docker/timeout/pause work) plus a readable
  // output stream (so we can still capture + export).
  private getTerminal(scriptPath: string): ManagedTerminal {
    const existing = this.terminals.get(scriptPath);
    if (existing) {
      return existing;
    }

    // Force powershell.exe (always present) because VS Code reliably activates
    // shell integration for it. We deliberately pass NO shellArgs: VS Code's
    // automatic shell-integration injection works by controlling the args, so
    // setting our own (e.g. -NoProfile) suppresses injection and we lose the
    // readable output stream (capture/export). The user's $PROFILE therefore
    // loads, which also means a profile-activated venv is inherited by cmd /c.
    const terminal = vscode.window.createTerminal({
      name: `BatRunner: ${path.basename(scriptPath)}`,
      cwd: path.dirname(scriptPath),
      shellPath: 'powershell.exe',
    });

    const ready = new Promise<vscode.TerminalShellIntegration | undefined>((resolve) => {
      if (terminal.shellIntegration) {
        resolve(terminal.shellIntegration);
        return;
      }
      const sub = vscode.window.onDidChangeTerminalShellIntegration((e) => {
        if (e.terminal === terminal) {
          clearTimeout(timer);
          sub.dispose();
          resolve(e.shellIntegration);
        }
      });
      const timer = setTimeout(() => {
        sub.dispose();
        resolve(undefined);
      }, SHELL_INTEGRATION_TIMEOUT_MS);
    });

    const managed: ManagedTerminal = { terminal, ready };
    this.terminals.set(scriptPath, managed);
    return managed;
  }

  async run(
    scriptPath: string,
    _encoding: string,
    onComplete?: (result: RunResult) => void
  ): Promise<void> {
    const startTime = new Date();
    const command = `cmd /c "${scriptPath}"`;
    const managed = this.getTerminal(scriptPath);
    managed.terminal.show();

    const si = await managed.ready;

    if (!si) {
      // No shell integration: still run it (real TTY works), but we cannot read
      // the output back, so there is nothing to capture/export for this run.
      managed.terminal.sendText(command, true);
      vscode.window.showWarningMessage(
        'BatRunner: terminal shell integration is unavailable, so this run cannot be captured or exported. The script still runs in the terminal.'
      );
      return;
    }

    const execution = si.executeCommand('cmd', ['/c', scriptPath]);

    // Publish a pending result up front and keep updating it as output streams.
    // This way Export always has something to save (so the log folder is created)
    // even if the run is still going or the shell never reports an end event.
    const result: RunResult = { scriptPath, command, startTime, exitCode: null, output: '' };
    this.lastRun = result;
    managed.result = result;

    // Keep the raw text (control codes intact) so we can re-strip exactly once
    // the command ends; append a cheap per-chunk strip in the meantime for live
    // export. \r\n is normalised to \n for a tidy log.
    let raw = '';
    const tidy = (s: string): string => stripAnsi(s).replace(/\r\n?/g, '\n');
    const readDone = (async () => {
      for await (const chunk of execution.read()) {
        raw += chunk;
        result.output += tidy(chunk);
      }
    })();

    const endSub = vscode.window.onDidEndTerminalShellExecution(async (e) => {
      if (e.execution !== execution) {
        return;
      }
      endSub.dispose();
      await readDone.catch(() => {});
      result.exitCode = e.exitCode ?? null;
      result.output = tidy(raw).replace(/^\n+/, '');
      onComplete?.(result);
    });
  }

  clearActive(): void {
    const active = vscode.window.activeTerminal;
    if (!active) {
      return;
    }
    for (const entry of this.terminals.values()) {
      if (entry.terminal === active) {
        // Clears the screen and the scrollback buffer of the active terminal.
        vscode.commands.executeCommand('workbench.action.terminal.clear');
        return;
      }
    }
  }

  dispose(): void {
    this.closeSub.dispose();
    for (const entry of this.terminals.values()) {
      entry.terminal.dispose();
    }
    this.terminals.clear();
  }
}
