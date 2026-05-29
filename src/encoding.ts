import * as iconv from 'iconv-lite';
import { StringDecoder } from 'string_decoder';

export function decode(buf: Buffer, codepage: string): string {
  const cp = codepage.toLowerCase();
  if (cp === 'utf8' || cp === 'utf-8') {
    return buf.toString('utf8');
  }
  return iconv.decode(buf, codepage);
}

/**
 * A stateful decoder that retains partial multi-byte characters across chunk
 * boundaries. Streamed process output can split a 2-byte cp950 (or multi-byte
 * UTF-8) character across two 'data' events; decoding each chunk independently
 * would corrupt it. write() buffers any trailing partial bytes until completed;
 * end() flushes whatever remains.
 */
export interface StreamDecoder {
  write(buf: Buffer): string;
  end(): string;
}

export function createDecoder(codepage: string): StreamDecoder {
  const cp = codepage.toLowerCase();
  if (cp === 'utf8' || cp === 'utf-8') {
    const sd = new StringDecoder('utf8');
    return {
      write: (buf: Buffer): string => sd.write(buf),
      end: (): string => sd.end(),
    };
  }
  const dec = iconv.getDecoder(codepage);
  return {
    write: (buf: Buffer): string => dec.write(buf),
    end: (): string => dec.end() ?? '',
  };
}
