import * as assert from 'assert';
import { decode } from '../../src/encoding';

describe('encoding.decode', () => {
  it('decodes cp950 bytes to Traditional Chinese', () => {
    // 0xA4A4 = 中, 0xA4E5 = 文 in Big5/cp950
    const buf = Buffer.from([0xA4, 0xA4, 0xA4, 0xE5]);
    assert.strictEqual(decode(buf, 'cp950'), '中文');
  });

  it('passes through utf8 unchanged', () => {
    const buf = Buffer.from('hello 中文', 'utf8');
    assert.strictEqual(decode(buf, 'utf8'), 'hello 中文');
  });
});
