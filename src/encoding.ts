import * as iconv from 'iconv-lite';

export function decode(buf: Buffer, codepage: string): string {
  const cp = codepage.toLowerCase();
  if (cp === 'utf8' || cp === 'utf-8') {
    return buf.toString('utf8');
  }
  return iconv.decode(buf, codepage);
}
