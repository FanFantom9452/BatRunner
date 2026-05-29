import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  formatTimestamp,
  formatHuman,
  buildLogFileName,
  getLogDir,
  buildLogContent,
  saveLog,
} from '../../src/exporter';
import { RunResult } from '../../src/types';

// Month is 0-based: 4 => May. => 2026-05-29 20:30:15
const fixed = new Date(2026, 4, 29, 20, 30, 15);

function sampleResult(scriptPath: string): RunResult {
  return {
    scriptPath,
    command: `cmd /c "${scriptPath}"`,
    startTime: fixed,
    exitCode: 0,
    output: 'hello\nworld\n',
  };
}

describe('exporter', () => {
  it('formatTimestamp produces a filename-safe stamp', () => {
    assert.strictEqual(formatTimestamp(fixed), '2026-05-29_203015');
  });

  it('formatHuman produces a readable stamp', () => {
    assert.strictEqual(formatHuman(fixed), '2026-05-29 20:30:15');
  });

  it('buildLogFileName uses base name + stamp', () => {
    assert.strictEqual(
      buildLogFileName(path.join('C:', 'x', 'deploy.bat'), fixed),
      'deploy.2026-05-29_203015.txt'
    );
  });

  it('getLogDir joins script dir + folder name', () => {
    assert.strictEqual(
      getLogDir(path.join('C:', 'x', 'deploy.bat'), 'batRunnerLogs'),
      path.join('C:', 'x', 'batRunnerLogs')
    );
  });

  it('buildLogContent includes header fields and the output', () => {
    const content = buildLogContent(sampleResult(path.join('C:', 'x', 'deploy.bat')));
    assert.ok(content.includes('Script : ' + path.join('C:', 'x', 'deploy.bat')));
    assert.ok(content.includes('Started: 2026-05-29 20:30:15'));
    assert.ok(content.includes('Exit   : 0'));
    assert.ok(content.endsWith('hello\nworld\n'));
  });

  it('saveLog writes a UTF-8 BOM file into the log dir', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'batrunner-'));
    const script = path.join(tmp, 'deploy.bat');
    await fs.writeFile(script, '@echo off\n');
    const p = await saveLog(sampleResult(script), { logFolderName: 'batRunnerLogs', utf8Bom: true });
    assert.strictEqual(path.dirname(p), path.join(tmp, 'batRunnerLogs'));
    const raw = await fs.readFile(p);
    assert.strictEqual(raw[0], 0xEF);
    assert.strictEqual(raw[1], 0xBB);
    assert.strictEqual(raw[2], 0xBF);
    assert.ok(raw.toString('utf8').includes('===== BatRunner ====='));
  });

  it('saveLog without BOM omits the BOM bytes', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'batrunner-'));
    const script = path.join(tmp, 'deploy.bat');
    await fs.writeFile(script, '@echo off\n');
    const p = await saveLog(sampleResult(script), { logFolderName: 'batRunnerLogs', utf8Bom: false });
    const raw = await fs.readFile(p);
    assert.notStrictEqual(raw[0], 0xEF);
  });
});
