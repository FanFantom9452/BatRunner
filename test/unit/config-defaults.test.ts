import * as assert from 'assert';
import { DEFAULT_CONFIG } from '../../src/config-defaults';

describe('config-defaults', () => {
  it('matches the values documented in the spec', () => {
    assert.strictEqual(DEFAULT_CONFIG.autoSave, false);
    assert.strictEqual(DEFAULT_CONFIG.encoding, 'cp950');
    assert.strictEqual(DEFAULT_CONFIG.logFolderName, 'batRunnerLogs');
    assert.strictEqual(DEFAULT_CONFIG.utf8Bom, true);
    assert.strictEqual(DEFAULT_CONFIG.terminalMode, 'integrated');
  });
});
