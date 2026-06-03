import * as assert from 'assert';
import { CLEAR_SEQUENCE, toTerminalText, exitLine, stripAnsi } from '../../src/format';

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

  it('stripAnsi removes OSC 633, CSI colors/erase and charset codes', () => {
    const input = '\x1b]633;C\x07\x1b[32mhello\x1b[0m world\x1b[2K\nline2\x1b(B done';
    assert.strictEqual(stripAnsi(input), 'hello world\nline2 done');
  });

  it('stripAnsi keeps plain text and whitespace untouched', () => {
    assert.strictEqual(stripAnsi('a\tb\r\nc'), 'a\tb\r\nc');
  });
});
