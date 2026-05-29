// xterm.js: 2J clears the visible screen, 3J clears the scrollback buffer,
// H homes the cursor. Firing all three makes scrolling up show nothing.
export const CLEAR_SEQUENCE = '\x1b[2J\x1b[3J\x1b[H';

export function toTerminalText(text: string): string {
  return text.replace(/\r?\n/g, '\r\n');
}

export function exitLine(code: number | null): string {
  const shown = code === null ? 'unknown' : String(code);
  return `\r\n[exit code: ${shown}]\r\n`;
}
