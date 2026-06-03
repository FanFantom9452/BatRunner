import * as vscode from 'vscode';
import * as path from 'path';
import { stripAnsi } from './format';
import { RunResult } from './types';

interface ManagedTerminal {
  terminal: vscode.Terminal;
  /** Resolves with the shell integration once active, or undefined on timeout. */
  ready: Promise<vscode.TerminalShellIntegration | undefined>;
}

// How long to wait for VS Code to activate shell integration before falling
// back to a plain (uncaptured) run.
const SHELL_INTEGRATION_TIMEOUT_MS = 8000;

export class Runner {
  private terminals = new Map<string, ManagedTerminal>();
  /** The most recently COMPLETED run (last to finish), shared across scripts. */
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

  // Get (or create) the real terminal for a script. We force powershell.exe
  // because VS Code reliably activates shell integration for it on Windows,
  // which gives us a real TTY (so docker/timeout/pause work) plus a readable
  // output stream (so we can still capture + export).
  private getTerminal(scriptPath: string): ManagedTerminal {
    const existing = this.terminals.get(scriptPath);
    if (existing) {
      return existing;
    }

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

    // Consume the output stream immediately so no data is missed. We keep the
    // raw text (with control codes) for the live terminal, but store an
    // ANSI-stripped copy for a clean exported log.
    let raw = '';
    const readDone = (async () => {
      for await (const chunk of execution.read()) {
        raw += chunk;
      }
    })();

    const endSub = vscode.window.onDidEndTerminalShellExecution(async (e) => {
      if (e.execution !== execution) {
        return;
      }
      endSub.dispose();
      await readDone.catch(() => {});
      const output = stripAnsi(raw).replace(/\r\n?/g, '\n').replace(/^\n+/, '');
      this.lastRun = {
        scriptPath,
        command,
        startTime,
        exitCode: e.exitCode ?? null,
        output,
      };
      onComplete?.(this.lastRun);
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
