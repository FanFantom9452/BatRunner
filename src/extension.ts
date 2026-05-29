import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { Runner } from './runner';
import { getConfig } from './config';
import { saveLog } from './exporter';

let runner: Runner;

function activeScriptPath(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }
  const ext = path.extname(editor.document.fileName).toLowerCase();
  if (ext !== '.bat' && ext !== '.cmd') {
    return undefined;
  }
  return editor.document.fileName;
}

function runInExternalCmd(scriptPath: string): void {
  const cwd = path.dirname(scriptPath);
  // `start "" cmd /k "<path>"` — the empty "" is the window title so a path
  // with spaces is not mistaken for the title. cmd /k keeps the window open.
  cp.spawn('cmd', ['/c', 'start', '', 'cmd', '/k', scriptPath], {
    cwd,
    detached: true,
    stdio: 'ignore',
  });
  vscode.window.showInformationMessage(
    'BatRunner: running in external CMD. Output cannot be captured or exported in this mode.'
  );
}

export function activate(context: vscode.ExtensionContext): void {
  runner = new Runner();
  context.subscriptions.push(runner);

  context.subscriptions.push(
    vscode.commands.registerCommand('batRunner.run', async () => {
      const editor = vscode.window.activeTextEditor;
      const scriptPath = activeScriptPath();
      if (!editor || !scriptPath) {
        vscode.window.showErrorMessage('BatRunner: active file is not a .bat/.cmd script.');
        return;
      }
      if (editor.document.isDirty) {
        await editor.document.save();
      }
      const config = getConfig();
      if (config.terminalMode === 'external') {
        runInExternalCmd(scriptPath);
        return;
      }
      runner.run(scriptPath, config.encoding, async (result) => {
        if (!config.autoSave) {
          return;
        }
        try {
          const p = await saveLog(result, {
            logFolderName: config.logFolderName,
            utf8Bom: config.utf8Bom,
          });
          vscode.window.setStatusBarMessage(`BatRunner: saved ${p}`, 4000);
        } catch (err) {
          vscode.window.showErrorMessage(
            `BatRunner: failed to save log: ${(err as Error).message}`
          );
        }
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('batRunner.exportLast', async () => {
      const result = runner.getLastRun();
      if (!result) {
        vscode.window.showInformationMessage('BatRunner: no run output to export yet.');
        return;
      }
      const config = getConfig();
      try {
        const p = await saveLog(result, {
          logFolderName: config.logFolderName,
          utf8Bom: config.utf8Bom,
        });
        const open = 'Open File';
        const choice = await vscode.window.showInformationMessage(`BatRunner: saved to ${p}`, open);
        if (choice === open) {
          const doc = await vscode.workspace.openTextDocument(p);
          await vscode.window.showTextDocument(doc);
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          `BatRunner: failed to save log: ${(err as Error).message}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('batRunner.runExternal', () => {
      const scriptPath = activeScriptPath();
      if (!scriptPath) {
        vscode.window.showErrorMessage('BatRunner: active file is not a .bat/.cmd script.');
        return;
      }
      runInExternalCmd(scriptPath);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('batRunner.clear', () => {
      runner.clearActive();
    })
  );
}

export function deactivate(): void {
  runner?.dispose();
}
