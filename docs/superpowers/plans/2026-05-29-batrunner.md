# BatRunner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A VSCode extension that runs `.bat`/`.cmd` from the editor title bar, captures the output via a Pseudoterminal, and exports it (with header + exit code) to a `batRunnerLogs/` folder as a UTF-8 file.

**Architecture:** The extension owns process I/O — it `spawn`s `cmd /c <script>` and pipes raw stdout/stderr into a `vscode.Pseudoterminal` for display while accumulating a buffer for export. Pure logic (encoding decode, log formatting, config defaults) lives in `vscode`-free modules so it is unit-testable with plain mocha; the thin `vscode` glue (`runner.ts`, `extension.ts`) is verified by an F5 manual checklist plus an optional integration harness.

**Tech Stack:** TypeScript, VSCode Extension API, `iconv-lite` (cp950 decode), `esbuild` (bundle), `mocha` + `ts-node` (unit tests), `@vscode/test-electron` (optional integration test).

---

## File Structure

| File | Responsibility | Imports vscode? |
|------|----------------|-----------------|
| `package.json` | Manifest: commands, menus, keybindings, configuration, scripts, deps | — |
| `src/types.ts` | `RunResult` interface | No |
| `src/encoding.ts` | `decode(buf, codepage)` via iconv-lite | No |
| `src/format.ts` | `CLEAR_SEQUENCE`, `toTerminalText`, `exitLine` | No |
| `src/exporter.ts` | Filename/header/content build + `saveLog` to disk | No |
| `src/config-defaults.ts` | `BatRunnerConfig` interface + `DEFAULT_CONFIG` | No |
| `src/config.ts` | `getConfig()` reading workspace settings | Yes |
| `src/runner.ts` | `Runner` class: Pseudoterminal + spawn + capture + clear | Yes |
| `src/extension.ts` | `activate()`: register 4 commands, wire Runner/exporter/config | Yes |
| `test/unit/*.test.ts` | Unit tests for vscode-free modules | No |
| `test/integration/**` | Optional `@vscode/test-electron` smoke test | Yes |
| `test/fixtures/sample.bat` | Sample script for manual + integration verification | — |

---

## Task 1: Project scaffold and build/test tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.js`
- Create: `.mocharc.json`
- Create: `.gitignore`
- Create: `.vscode/launch.json`
- Create: `.vscode/tasks.json`
- Create: `test/unit/smoke.test.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "batrunner",
  "displayName": "BatRunner",
  "description": "Run .bat/.cmd from the editor title bar, capture output, and export to UTF-8 logs.",
  "version": "0.1.0",
  "publisher": "local",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      { "command": "batRunner.run", "title": "BatRunner: Run", "icon": "$(play)" },
      { "command": "batRunner.exportLast", "title": "BatRunner: Export Last Output", "icon": "$(save)" },
      { "command": "batRunner.runExternal", "title": "BatRunner: Run in External CMD" },
      { "command": "batRunner.clear", "title": "BatRunner: Clear Terminal" }
    ],
    "menus": {
      "editor/title": [
        { "command": "batRunner.run", "when": "resourceExtname == .bat || resourceExtname == .cmd", "group": "navigation@1" },
        { "command": "batRunner.exportLast", "when": "resourceExtname == .bat || resourceExtname == .cmd", "group": "navigation@2" }
      ],
      "terminal/context": [
        { "command": "batRunner.clear", "group": "navigation" }
      ]
    },
    "keybindings": [
      { "command": "batRunner.clear", "key": "ctrl+alt+l", "when": "terminalFocus" }
    ],
    "configuration": {
      "title": "BatRunner",
      "properties": {
        "batRunner.autoSave": { "type": "boolean", "default": false, "description": "Automatically export output to a log file after each run." },
        "batRunner.encoding": { "type": "string", "default": "cp950", "description": "Codepage used to decode script output (e.g. cp950 for Traditional Chinese Windows, utf8)." },
        "batRunner.logFolderName": { "type": "string", "default": "batRunnerLogs", "description": "Name of the subfolder (next to the script) where logs are saved." },
        "batRunner.utf8Bom": { "type": "boolean", "default": true, "description": "Write a UTF-8 BOM at the start of exported log files." },
        "batRunner.terminalMode": { "type": "string", "enum": ["integrated", "external"], "default": "integrated", "description": "Default place to run scripts." }
      }
    }
  },
  "scripts": {
    "compile": "node esbuild.js",
    "watch": "node esbuild.js --watch",
    "test:unit": "mocha",
    "vscode:prepublish": "node esbuild.js --production"
  },
  "devDependencies": {
    "@types/mocha": "^10.0.6",
    "@types/node": "^20.11.0",
    "@types/vscode": "^1.85.0",
    "esbuild": "^0.20.0",
    "mocha": "^10.3.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.0"
  },
  "dependencies": {
    "iconv-lite": "^0.6.3"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "lib": ["ES2020"],
    "outDir": "out",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "dist", "out"]
}
```

- [ ] **Step 3: Write `esbuild.js`**

```js
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    sourcemap: !production,
    minify: production,
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Write `.mocharc.json`**

```json
{
  "require": "ts-node/register",
  "spec": "test/unit/**/*.test.ts"
}
```

- [ ] **Step 5: Write `.gitignore`**

```gitignore
node_modules/
dist/
out/
*.vsix
```

- [ ] **Step 6: Write `.vscode/launch.json`**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "npm: compile"
    }
  ]
}
```

- [ ] **Step 7: Write `.vscode/tasks.json`**

```json
{
  "version": "2.0.0",
  "tasks": [
    { "type": "npm", "script": "compile", "problemMatcher": [], "label": "npm: compile" }
  ]
}
```

- [ ] **Step 8: Write the smoke test `test/unit/smoke.test.ts`**

```ts
import * as assert from 'assert';

describe('smoke', () => {
  it('runs the test toolchain', () => {
    assert.strictEqual(1 + 1, 2);
  });
});
```

- [ ] **Step 9: Install dependencies**

Run: `npm install`
Expected: completes without errors; `node_modules/` created; `iconv-lite`, `esbuild`, `mocha`, `ts-node`, `typescript` present.

- [ ] **Step 10: Verify the unit test toolchain runs**

Run: `npm run test:unit`
Expected: `1 passing` (the smoke test).

- [ ] **Step 11: Verify the bundler builds**

Run: `npm run compile`
Expected: command fails OR succeeds with "Could not resolve src/extension.ts" — at this point `src/extension.ts` does not exist yet, so a "Could not resolve" error is acceptable. (It will succeed after Task 7.) Do NOT block on this step; the smoke test passing in Step 10 is the gate.

- [ ] **Step 12: Commit**

```bash
git add package.json tsconfig.json esbuild.js .mocharc.json .gitignore .vscode/ test/unit/smoke.test.ts
git commit -m "chore: scaffold BatRunner extension (manifest, build, test tooling)"
```

---

## Task 2: `types.ts` and `encoding.ts` (cp950 decode)

**Files:**
- Create: `src/types.ts`
- Create: `src/encoding.ts`
- Test: `test/unit/encoding.test.ts`

- [ ] **Step 1: Write `src/types.ts`**

```ts
export interface RunResult {
  scriptPath: string;
  command: string;
  startTime: Date;
  exitCode: number | null;
  output: string;
}
```

- [ ] **Step 2: Write the failing test `test/unit/encoding.test.ts`**

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — cannot find module `../../src/encoding`.

- [ ] **Step 4: Write `src/encoding.ts`**

```ts
import * as iconv from 'iconv-lite';

export function decode(buf: Buffer, codepage: string): string {
  const cp = codepage.toLowerCase();
  if (cp === 'utf8' || cp === 'utf-8') {
    return buf.toString('utf8');
  }
  return iconv.decode(buf, codepage);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit`
Expected: `encoding.decode` tests pass (smoke still passing too).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/encoding.ts test/unit/encoding.test.ts
git commit -m "feat: add RunResult type and cp950/utf8 output decoder"
```

---

## Task 3: `format.ts` (terminal formatting + clear sequence)

**Files:**
- Create: `src/format.ts`
- Test: `test/unit/format.test.ts`

- [ ] **Step 1: Write the failing test `test/unit/format.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — cannot find module `../../src/format`.

- [ ] **Step 3: Write `src/format.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit`
Expected: all `format` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/format.ts test/unit/format.test.ts
git commit -m "feat: add terminal text formatting and scrollback-clearing sequence"
```

---

## Task 4: `exporter.ts` (filename, header, content, saveLog)

**Files:**
- Create: `src/exporter.ts`
- Test: `test/unit/exporter.test.ts`

- [ ] **Step 1: Write the failing test `test/unit/exporter.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — cannot find module `../../src/exporter`.

- [ ] **Step 3: Write `src/exporter.ts`**

```ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { RunResult } from './types';

export interface ExportConfig {
  logFolderName: string;
  utf8Bom: boolean;
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function formatTimestamp(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function formatHuman(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export function buildLogFileName(scriptPath: string, startTime: Date): string {
  const base = path.basename(scriptPath, path.extname(scriptPath));
  return `${base}.${formatTimestamp(startTime)}.txt`;
}

export function getLogDir(scriptPath: string, logFolderName: string): string {
  return path.join(path.dirname(scriptPath), logFolderName);
}

export function buildLogContent(result: RunResult): string {
  const header =
    '===== BatRunner =====\n' +
    `Script : ${result.scriptPath}\n` +
    `Command: ${result.command}\n` +
    `Started: ${formatHuman(result.startTime)}\n` +
    `Exit   : ${result.exitCode === null ? 'unknown' : result.exitCode}\n` +
    '=====================\n\n';
  return header + result.output;
}

export async function saveLog(result: RunResult, config: ExportConfig): Promise<string> {
  const dir = getLogDir(result.scriptPath, config.logFolderName);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, buildLogFileName(result.scriptPath, result.startTime));
  const bom = config.utf8Bom ? String.fromCharCode(0xFEFF) : '';
  await fs.writeFile(filePath, bom + buildLogContent(result), { encoding: 'utf8' });
  return filePath;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit`
Expected: all `exporter` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/exporter.ts test/unit/exporter.test.ts
git commit -m "feat: add log exporter (filename, header, UTF-8 BOM write)"
```

---

## Task 5: `config-defaults.ts` and `config.ts`

**Files:**
- Create: `src/config-defaults.ts`
- Create: `src/config.ts`
- Test: `test/unit/config-defaults.test.ts`

- [ ] **Step 1: Write the failing test `test/unit/config-defaults.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — cannot find module `../../src/config-defaults`.

- [ ] **Step 3: Write `src/config-defaults.ts`**

```ts
export interface BatRunnerConfig {
  autoSave: boolean;
  encoding: string;
  logFolderName: string;
  utf8Bom: boolean;
  terminalMode: 'integrated' | 'external';
}

export const DEFAULT_CONFIG: BatRunnerConfig = {
  autoSave: false,
  encoding: 'cp950',
  logFolderName: 'batRunnerLogs',
  utf8Bom: true,
  terminalMode: 'integrated',
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit`
Expected: `config-defaults` test passes.

- [ ] **Step 5: Write `src/config.ts` (vscode wrapper; not unit-tested)**

```ts
import * as vscode from 'vscode';
import { BatRunnerConfig, DEFAULT_CONFIG } from './config-defaults';

export function getConfig(): BatRunnerConfig {
  const c = vscode.workspace.getConfiguration('batRunner');
  return {
    autoSave: c.get('autoSave', DEFAULT_CONFIG.autoSave),
    encoding: c.get('encoding', DEFAULT_CONFIG.encoding),
    logFolderName: c.get('logFolderName', DEFAULT_CONFIG.logFolderName),
    utf8Bom: c.get('utf8Bom', DEFAULT_CONFIG.utf8Bom),
    terminalMode: c.get('terminalMode', DEFAULT_CONFIG.terminalMode),
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/config-defaults.ts src/config.ts test/unit/config-defaults.test.ts
git commit -m "feat: add config defaults and workspace settings reader"
```

---

## Task 6: `runner.ts` (Pseudoterminal + spawn + capture + clear)

**Files:**
- Create: `src/runner.ts`

This module imports `vscode` and is verified by compile (Task 7 build) plus the manual checklist (Task 8). Its pure dependencies (`decode`, `toTerminalText`, `exitLine`) are already unit-tested.

- [ ] **Step 1: Write `src/runner.ts`**

```ts
import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { decode } from './encoding';
import { CLEAR_SEQUENCE, toTerminalText, exitLine } from './format';
import { RunResult } from './types';

interface ActiveTerminal {
  terminal: vscode.Terminal;
  writeEmitter: vscode.EventEmitter<string>;
}

export class Runner {
  private terminals = new Map<string, ActiveTerminal>();
  private lastRun: RunResult | undefined;

  getLastRun(): RunResult | undefined {
    return this.lastRun;
  }

  run(scriptPath: string, encoding: string, onComplete?: (result: RunResult) => void): void {
    const cwd = path.dirname(scriptPath);
    const command = `cmd /c "${scriptPath}"`;
    const startTime = new Date();
    let buffer = '';
    let child: ChildProcess | undefined;

    const writeEmitter = new vscode.EventEmitter<string>();
    const closeEmitter = new vscode.EventEmitter<number | void>();

    const append = (data: Buffer): void => {
      const text = decode(data, encoding);
      buffer += text;
      writeEmitter.fire(toTerminalText(text));
    };

    const pty: vscode.Pseudoterminal = {
      onDidWrite: writeEmitter.event,
      onDidClose: closeEmitter.event,
      open: () => {
        writeEmitter.fire(`> ${command}\r\n\r\n`);
        // No `encoding` option: we need raw Buffers so iconv can decode cp950.
        child = spawn('cmd', ['/c', scriptPath], { cwd });
        child.stdout?.on('data', append);
        child.stderr?.on('data', append);
        child.on('error', (err) => {
          writeEmitter.fire(toTerminalText(`\n[BatRunner] spawn error: ${err.message}\n`));
        });
        child.on('exit', (code) => {
          writeEmitter.fire(exitLine(code));
          this.lastRun = { scriptPath, command, startTime, exitCode: code, output: buffer };
          onComplete?.(this.lastRun);
          // Intentionally keep the terminal open (do not fire closeEmitter).
        });
      },
      close: () => {
        child?.kill();
      },
    };

    // Reuse strategy: dispose any prior terminal for this script so output
    // does not pile up; the fresh terminal starts empty (no scrollback).
    const existing = this.terminals.get(scriptPath);
    if (existing) {
      existing.terminal.dispose();
      this.terminals.delete(scriptPath);
    }

    const terminal = vscode.window.createTerminal({
      name: `BatRunner: ${path.basename(scriptPath)}`,
      pty,
    });
    this.terminals.set(scriptPath, { terminal, writeEmitter });
    terminal.show();
  }

  clearActive(): void {
    const active = vscode.window.activeTerminal;
    if (!active) {
      return;
    }
    for (const entry of this.terminals.values()) {
      if (entry.terminal === active) {
        entry.writeEmitter.fire(CLEAR_SEQUENCE);
        return;
      }
    }
  }

  dispose(): void {
    for (const entry of this.terminals.values()) {
      entry.terminal.dispose();
    }
    this.terminals.clear();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/runner.ts
git commit -m "feat: add Runner with Pseudoterminal capture, reuse, and clear"
```

---

## Task 7: `extension.ts` (register commands, wire everything)

**Files:**
- Create: `src/extension.ts`

- [ ] **Step 1: Write `src/extension.ts`**

```ts
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { Runner } from './runner';
import { getConfig } from './config';
import { saveLog } from './exporter';

let runner: Runner;

function activeScriptPath(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }
  const ext = path.extname(editor.document.fileName).toLowerCase();
  if (ext !== '.bat' && ext !== '.cmd') {
    return undefined;
  }
  return editor.document.fileName;
}

function runInExternalCmd(scriptPath: string): void {
  const cwd = path.dirname(scriptPath);
  // `start "" cmd /k "<path>"` — the empty "" is the window title so a path
  // with spaces is not mistaken for the title. cmd /k keeps the window open.
  cp.spawn('cmd', ['/c', 'start', '', 'cmd', '/k', scriptPath], {
    cwd,
    detached: true,
    stdio: 'ignore',
  });
  vscode.window.showInformationMessage(
    'BatRunner: running in external CMD. Output cannot be captured or exported in this mode.'
  );
}

export function activate(context: vscode.ExtensionContext): void {
  runner = new Runner();
  context.subscriptions.push(runner);

  context.subscriptions.push(
    vscode.commands.registerCommand('batRunner.run', async () => {
      const editor = vscode.window.activeTextEditor;
      const scriptPath = activeScriptPath();
      if (!editor || !scriptPath) {
        vscode.window.showErrorMessage('BatRunner: active file is not a .bat/.cmd script.');
        return;
      }
      if (editor.document.isDirty) {
        await editor.document.save();
      }
      const config = getConfig();
      if (config.terminalMode === 'external') {
        runInExternalCmd(scriptPath);
        return;
      }
      runner.run(scriptPath, config.encoding, async (result) => {
        if (!config.autoSave) {
          return;
        }
        try {
          const p = await saveLog(result, {
            logFolderName: config.logFolderName,
            utf8Bom: config.utf8Bom,
          });
          vscode.window.setStatusBarMessage(`BatRunner: saved ${p}`, 4000);
        } catch (err) {
          vscode.window.showErrorMessage(
            `BatRunner: failed to save log: ${(err as Error).message}`
          );
        }
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('batRunner.exportLast', async () => {
      const result = runner.getLastRun();
      if (!result) {
        vscode.window.showInformationMessage('BatRunner: no run output to export yet.');
        return;
      }
      const config = getConfig();
      try {
        const p = await saveLog(result, {
          logFolderName: config.logFolderName,
          utf8Bom: config.utf8Bom,
        });
        const open = 'Open File';
        const choice = await vscode.window.showInformationMessage(`BatRunner: saved to ${p}`, open);
        if (choice === open) {
          const doc = await vscode.workspace.openTextDocument(p);
          await vscode.window.showTextDocument(doc);
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          `BatRunner: failed to save log: ${(err as Error).message}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('batRunner.runExternal', () => {
      const scriptPath = activeScriptPath();
      if (!scriptPath) {
        vscode.window.showErrorMessage('BatRunner: active file is not a .bat/.cmd script.');
        return;
      }
      runInExternalCmd(scriptPath);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('batRunner.clear', () => {
      runner.clearActive();
    })
  );
}

export function deactivate(): void {
  runner?.dispose();
}
```

- [ ] **Step 2: Verify the bundler builds the full extension**

Run: `npm run compile`
Expected: succeeds; `dist/extension.js` is created with no "Could not resolve" errors.

- [ ] **Step 3: Verify all unit tests still pass**

Run: `npm run test:unit`
Expected: all tests pass (smoke, encoding, format, exporter, config-defaults).

- [ ] **Step 4: Commit**

```bash
git add src/extension.ts
git commit -m "feat: register run/export/runExternal/clear commands and wire modules"
```

---

## Task 8: Sample script, README, and manual verification (REQUIRED)

**Files:**
- Create: `test/fixtures/sample.bat`
- Create: `README.md`

- [ ] **Step 1: Write `test/fixtures/sample.bat`**

```bat
@echo off
echo Hello from BatRunner
echo 中文測試輸出
echo Current dir: %CD%
exit /b 0
```

- [ ] **Step 2: Write `README.md`**

````markdown
# BatRunner

Run `.bat` / `.cmd` scripts from the VSCode editor title bar, capture their
output in an integrated terminal, and export it to a UTF-8 log file.

## Features

- ▶ **Run** (editor title bar): runs the active script in an integrated
  terminal at the script's own folder. The terminal stays open after the run.
- 💾 **Export Last Output** (editor title bar): saves the captured output to
  `batRunnerLogs/<name>.<timestamp>.txt` next to the script, as UTF-8.
- **Run in External CMD** (Command Palette): opens an external `cmd /k`
  window. Output cannot be captured or exported in this mode.
- **Clear Terminal** (terminal right-click menu / `Ctrl+Alt+L`): clears the
  screen *and* scrollback (so scrolling up shows nothing).

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `batRunner.autoSave` | `false` | Auto-export output after each run. |
| `batRunner.encoding` | `cp950` | Codepage to decode output (use `utf8` if your scripts emit UTF-8). |
| `batRunner.logFolderName` | `batRunnerLogs` | Log subfolder name. |
| `batRunner.utf8Bom` | `true` | Add a UTF-8 BOM to exported files. |
| `batRunner.terminalMode` | `integrated` | Default run location. |

## Develop

- `npm install`
- `npm run compile` — bundle with esbuild
- `npm run test:unit` — run unit tests
- Press `F5` to launch the Extension Development Host.
````

- [ ] **Step 3: Manual verification — run and capture**

1. Run `npm run compile`.
2. Press `F5` to open the Extension Development Host.
3. Open `test/fixtures/sample.bat` in the host window.
4. Confirm a ▶ and 💾 icon appear at the editor's top-right.
5. Click ▶. Confirm: a terminal "BatRunner: sample.bat" opens, shows the
   command line, then `Hello from BatRunner`, `中文測試輸出` (no mojibake),
   the current dir, and `[exit code: 0]`. Confirm the terminal stays open.

Expected: Chinese renders correctly; exit code line appears.

- [ ] **Step 4: Manual verification — export**

1. With the run complete, click 💾.
2. Confirm an info message shows the saved path under
   `test/fixtures/batRunnerLogs/sample.<timestamp>.txt`.
3. Click "Open File". Confirm the header (Script/Command/Started/Exit) and the
   Chinese output are correct and readable.

Expected: file exists, UTF-8, Chinese readable, header correct.

- [ ] **Step 5: Manual verification — clear scrollback**

1. Run ▶ again so there is scrollback.
2. Right-click in the terminal → "BatRunner: Clear Terminal" (or press
   `Ctrl+Alt+L` with the terminal focused).
3. Scroll up with the mouse wheel.

Expected: nothing above — both screen and scrollback are cleared.

- [ ] **Step 6: Manual verification — external mode**

1. Open the Command Palette, run "BatRunner: Run in External CMD".
2. Confirm an external CMD window opens, runs the script, and stays open.
3. Confirm the info message warns that output cannot be exported in this mode.

Expected: external window stays open; warning shown.

- [ ] **Step 7: Commit**

```bash
git add test/fixtures/sample.bat README.md
git commit -m "docs: add sample script, README, and manual verification fixture"
```

---

## Task 9 (OPTIONAL): Integration smoke test via `@vscode/test-electron`

This is heavier (downloads a VSCode build, needs network) and the glue layer is
already covered by Task 8's manual checklist. Implement only if an automated
end-to-end gate is wanted. Spec §9 lists it as a strategy.

**Files:**
- Create: `test/integration/runTest.ts`
- Create: `test/integration/suite/index.ts`
- Create: `test/integration/suite/extension.test.ts`
- Modify: `package.json` (add devDep `@vscode/test-electron`, `glob`; add scripts `compile:test`, `test:int`)

- [ ] **Step 1: Add devDeps and scripts to `package.json`**

Add to `devDependencies`:
```json
"@vscode/test-electron": "^2.3.9",
"glob": "^10.3.10"
```
Add to `scripts`:
```json
"compile:test": "tsc -p ./tsconfig.json",
"test:int": "npm run compile && npm run compile:test && node ./out/test/integration/runTest.js"
```
Then run: `npm install`
Expected: completes without errors.

- [ ] **Step 2: Write `test/integration/runTest.ts`**

```ts
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error('Failed to run integration tests', err);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 3: Write `test/integration/suite/index.ts`**

```ts
import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'bdd', color: true, timeout: 60000 });
  const testsRoot = __dirname;
  const files = await glob('**/*.test.js', { cwd: testsRoot });
  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
  return new Promise((resolve, reject) => {
    mocha.run((failures) => (failures > 0 ? reject(new Error(`${failures} tests failed`)) : resolve()));
  });
}
```

- [ ] **Step 4: Write `test/integration/suite/extension.test.ts`**

```ts
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return predicate();
}

describe('BatRunner integration', () => {
  it('runs a sample .bat and auto-saves a log file', async () => {
    const fixture = path.resolve(__dirname, '../../../test/fixtures/sample.bat');
    const logDir = path.join(path.dirname(fixture), 'batRunnerLogs');

    await vscode.workspace.getConfiguration('batRunner').update('autoSave', true, vscode.ConfigurationTarget.Global);

    const doc = await vscode.workspace.openTextDocument(fixture);
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand('batRunner.run');

    const appeared = await waitFor(
      () => fs.existsSync(logDir) && fs.readdirSync(logDir).some((f) => f.startsWith('sample.') && f.endsWith('.txt')),
      30000
    );
    assert.ok(appeared, 'expected a sample.*.txt log file in batRunnerLogs/');

    const file = fs.readdirSync(logDir).find((f) => f.startsWith('sample.'))!;
    const content = fs.readFileSync(path.join(logDir, file), 'utf8');
    assert.ok(content.includes('===== BatRunner ====='));
    assert.ok(content.includes('Hello from BatRunner'));
  });
});
```

- [ ] **Step 5: Run the integration test**

Run: `npm run test:int`
Expected: downloads a VSCode build (first run only), launches it, `1 passing`.
Note: requires network for the first download; if offline, skip this task — Task 8 manual checklist is the gate.

- [ ] **Step 6: Commit**

```bash
git add package.json test/integration/
git commit -m "test: add optional @vscode/test-electron integration smoke test"
```

---

## Notes for the implementer

- **Windows only (v1).** All commands assume `cmd.exe`. Do not add `.ps1`/`.sh`
  handling — that is explicitly out of scope.
- **Raw Buffers are mandatory.** Never pass an `encoding` option to `spawn`;
  decoding must happen in `encoding.decode` so cp950 works.
- **Keep `vscode` out of `types/encoding/format/exporter/config-defaults`** so
  the unit tests keep running in plain node.
- **DRY/YAGNI/TDD/frequent commits** — one commit per task as shown.
