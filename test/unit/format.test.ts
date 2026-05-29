import * as assert from 'assert';
import { CLEAR_SEQUENCE, toTerminalText, exitLine } from '../../src/format';

describe('format', () => {
  it('CLEAR_SEQUENCE clears screen (2J) and scrollback (3J) then homes cursor', () => {
    assert.strictEqual(CLEAR_SEQUENCE, '\x1b[2J\x1b[3J\x1b[H');
  });

  it('toTerminalText converts lone \\n to \\r\\n', () => {
    assert.strictEqual(toTerminalText('a\nb'), 'a\r\nb');
  });

  it('toTerminalText leaves existing \\r\\n intact (idempotent)', () => {
    assert.strictEqual(toTerminalText('a\r\nb'), 'a\r\nb');
  });

  it('exitLine formats a numeric code', () => {
    assert.strictEqual(exitLine(0), '\r\n[exit code: 0]\r\n');
  });

  it('exitLine handles a null code', () => {
    assert.strictEqual(exitLine(null), '\r\n[exit code: unknown]\r\n');
  });
});
