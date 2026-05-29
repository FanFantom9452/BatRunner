import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { createDecoder } from './encoding';
import { CLEAR_SEQUENCE, toTerminalText, exitLine } from './format';
import { RunResult } from './types';

interface ActiveTerminal {
  terminal: vscode.Terminal;
  writeEmitter: vscode.EventEmitter<string>;
}

export class Runner {
  private terminals = new Map<string, ActiveTerminal>();
  /** The most recently COMPLETED run (last to finish), shared across scripts. */
  private lastRun: RunResult | undefined;
  private closeSub: vscode.Disposable;

  constructor() {
    // Drop map entries when the user closes a managed terminal from the UI,
    // so we never hold disposed terminals / dead emitters.
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

  run(scriptPath: string, encoding: string, onComplete?: (result: RunResult) => void): void {
    const cwd = path.dirname(scriptPath);
    const command = `cmd /c "${scriptPath}"`;
    const startTime = new Date();
    let buffer = '';
    let child: ChildProcess | undefined;

    const writeEmitter = new vscode.EventEmitter<string>();
    const closeEmitter = new vscode.EventEmitter<number | void>();

    // One stateful decoder per stream: retains partial multi-byte characters
    // across chunk boundaries so split cp950/UTF-8 chars are not corrupted.
    const decOut = createDecoder(encoding);
    const decErr = createDecoder(encoding);

    const emit = (text: string): void => {
      if (!text) {
        return;
      }
      buffer += text;
      writeEmitter.fire(toTerminalText(text));
    };

    const pty: vscode.Pseudoterminal = {
      onDidWrite: writeEmitter.event,
      onDidClose: closeEmitter.event,
      open: () => {
        writeEmitter.fire(`> ${command}\r\n\r\n`);
        // No `encoding` option: raw Buffers so the decoder controls decoding.
        // Quote the path + shell:true so paths with spaces or cmd metacharacters
        // (&, ^, (, )) run correctly (Node runs cmd.exe /d /s /c ""<path>"").
        child = spawn(`"${scriptPath}"`, { cwd, shell: true });
        child.stdout?.on('data', (data: Buffer) => emit(decOut.write(data)));
        child.stderr?.on('data', (data: Buffer) => emit(decErr.write(data)));
        child.on('error', (err) => {
          writeEmitter.fire(toTerminalText(`\n[BatRunner] spawn error: ${err.message}\n`));
        });
        child.on('exit', (code) => {
          emit(decOut.end()); // flush trailing partial characters
          emit(decErr.end());
          writeEmitter.fire(exitLine(code));
          this.lastRun = { scriptPath, command, startTime, exitCode: code, output: buffer };
          onComplete?.(this.lastRun);
          // Intentionally keep the terminal open (do not fire closeEmitter).
        });
      },
      close: () => {
        child?.kill();
      },
    };

    // Reuse strategy: dispose any prior terminal for this script so output
    // does not pile up; the fresh terminal starts empty (no scrollback).
    const existing = this.terminals.get(scriptPath);
    if (existing) {
      existing.terminal.dispose();
      this.terminals.delete(scriptPath);
    }

    const terminal = vscode.window.createTerminal({
      name: `BatRunner: ${path.basename(scriptPath)}`,
      pty,
    });
    this.terminals.set(scriptPath, { terminal, writeEmitter });
    terminal.show();
  }

  clearActive(): void {
    const active = vscode.window.activeTerminal;
    if (!active) {
      return;
    }
    for (const entry of this.terminals.values()) {
      if (entry.terminal === active) {
        entry.writeEmitter.fire(CLEAR_SEQUENCE);
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
