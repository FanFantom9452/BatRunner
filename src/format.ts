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

// The shell-integration output stream carries raw terminal control codes
// (colors, cursor moves, and VS Code's own OSC 633 markers). Strip them so the
// exported log is plain readable text. \x1b = ESC, \x07 = BEL. Whitespace
// (\r \n \t) is preserved.
const OSC = /\x1b\][\s\S]*?(?:\x07|\x1b\\)/g; // OSC ... (BEL or ST)
const CSI = /\x1b\[[0-9;?]*[\x20-\x2f]*[@-~]/g; // CSI ... final byte
const CHARSET = /\x1b[()#][\s\S]/g; // charset select, e.g. ESC ( B
const SINGLE = /\x1b[=>78Mc]/g; // single-char escapes (keypad, save/restore)

export function stripAnsi(text: string): string {
  return text.replace(OSC, '').replace(CSI, '').replace(CHARSET, '').replace(SINGLE, '');
}
