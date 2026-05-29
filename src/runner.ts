import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { decode } from './encoding';
import { CLEAR_SEQUENCE, toTerminalText, exitLine } from './format';
import { RunResult } from './types';

interface ActiveTerminal {
  terminal: vscode.Terminal;
  writeEmitter: vscode.EventEmitter<string>;
}

export class Runner {
  private terminals = new Map<string, ActiveTerminal>();
  private lastRun: RunResult | undefined;

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

    const append = (data: Buffer): void => {
      const text = decode(data, encoding);
      buffer += text;
      writeEmitter.fire(toTerminalText(text));
    };

    const pty: vscode.Pseudoterminal = {
      onDidWrite: writeEmitter.event,
      onDidClose: closeEmitter.event,
      open: () => {
        writeEmitter.fire(`> ${command}\r\n\r\n`);
        // No `encoding` option: we need raw Buffers so iconv can decode cp950.
        child = spawn('cmd', ['/c', scriptPath], { cwd });
        child.stdout?.on('data', append);
        child.stderr?.on('data', append);
        child.on('error', (err) => {
          writeEmitter.fire(toTerminalText(`\n[BatRunner] spawn error: ${err.message}\n`));
        });
        child.on('exit', (code) => {
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
    for (const entry of this.terminals.values()) {
      entry.terminal.dispose();
    }
    this.terminals.clear();
  }
}
