import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return predicate();
}

describe('BatRunner integration', () => {
  it('runs a sample .bat and auto-saves a log file', async () => {
    const fixture = path.resolve(__dirname, '../../../../test/fixtures/sample.bat');
    const logDir = path.join(path.dirname(fixture), 'batRunnerLogs');

    await vscode.workspace
      .getConfiguration('batRunner')
      .update('autoSave', true, vscode.ConfigurationTarget.Global);

    const doc = await vscode.workspace.openTextDocument(fixture);
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand('batRunner.run');

    const appeared = await waitFor(
      () =>
        fs.existsSync(logDir) &&
        fs.readdirSync(logDir).some((f) => f.startsWith('sample.') && f.endsWith('.txt')),
      30000
    );
    assert.ok(appeared, 'expected a sample.*.txt log file in batRunnerLogs/');

    const file = fs.readdirSync(logDir).find((f) => f.startsWith('sample.'))!;
    const content = fs.readFileSync(path.join(logDir, file), 'utf8');
    assert.ok(content.includes('===== BatRunner ====='));
    assert.ok(content.includes('Hello from BatRunner'));
  });
});
