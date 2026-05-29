import * as assert from 'assert';
import { decode, createDecoder } from '../../src/encoding';

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

describe('encoding.createDecoder', () => {
  it('reassembles a cp950 char split across chunks', () => {
    const d = createDecoder('cp950');
    // 中 = A4 A4 (complete), then A4 = first byte of 文
    let out = d.write(Buffer.from([0xA4, 0xA4, 0xA4]));
    out += d.write(Buffer.from([0xE5])); // second byte of 文
    out += d.end();
    assert.strictEqual(out, '中文');
  });

  it('reassembles a utf8 char split across chunks', () => {
    const d = createDecoder('utf8');
    const bytes = Buffer.from('中', 'utf8'); // E4 B8 AD
    let out = d.write(bytes.subarray(0, 2));
    out += d.write(bytes.subarray(2));
    out += d.end();
    assert.strictEqual(out, '中');
  });

  it('decodes a whole cp950 buffer in one write', () => {
    const d = createDecoder('cp950');
    const out = d.write(Buffer.from([0xA4, 0xA4, 0xA4, 0xE5])) + d.end();
    assert.strictEqual(out, '中文');
  });
});
