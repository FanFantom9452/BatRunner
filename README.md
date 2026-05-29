# BatRunner

Run `.bat` / `.cmd` scripts from the VSCode editor title bar, capture their
output in an integrated terminal, and export it to a UTF-8 log file.

## Install

Requires VS Code already installed with the `code` CLI on PATH (the Windows
installer adds it by default; on macOS run "Shell Command: Install 'code'
command in PATH"). These download the latest release `.vsix` and sideload it
into **official VS Code** — no Marketplace account needed.

**One command (Windows CMD):**

```bat
curl -fL -o "%TEMP%\batrunner.vsix" https://github.com/FanFantom9452/BatRunner/releases/latest/download/batrunner.vsix && code --install-extension "%TEMP%\batrunner.vsix"
```

**One command (Windows PowerShell):**

```powershell
iwr https://github.com/FanFantom9452/BatRunner/releases/latest/download/batrunner.vsix -OutFile "$env:TEMP\batrunner.vsix"; code --install-extension "$env:TEMP\batrunner.vsix"
```

**One command (macOS / Linux):**

```bash
curl -fL -o /tmp/batrunner.vsix https://github.com/FanFantom9452/BatRunner/releases/latest/download/batrunner.vsix && code --install-extension /tmp/batrunner.vsix
```

Then reload VS Code (or just relaunch it). Re-running the same command later
upgrades to the newest release. Sideloaded extensions do not auto-update, so
re-run to update. The `-f` flag makes `curl` fail loudly if the download is
missing, so a 404 never gets installed as a broken file.

Manual alternative: download `batrunner.vsix` from the repo's Releases page, then
in VS Code → Extensions → `...` → "Install from VSIX...".

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
| `batRunner.terminalMode` | `integrated` | Default run location (`integrated` or `external`). |

## Encoding (Chinese / non-ASCII output)

Windows `cmd` emits text in the console's OEM codepage, which on Traditional
Chinese Windows is **cp950** (Big5). BatRunner reads the script's RAW output
bytes and decodes them with `batRunner.encoding` (default `cp950`), so Chinese
output is captured and exported correctly without mojibake.

- If your scripts run on a cp950 console (the zh-TW default), keep `cp950`.
- If your scripts emit UTF-8 (e.g. they run `chcp 65001` first), set
  `batRunner.encoding` to `utf8`.

`test/fixtures/sample.bat` is ASCII-only on purpose, so it displays correctly
regardless of console codepage.

## Develop

- `npm install`
- `npm run compile` — bundle with esbuild
- `npm run test:unit` — run unit tests
- Press `F5` to launch the Extension Development Host.

## Manual verification (run in the Extension Development Host)

1. `npm run compile`, then press `F5` to open the Extension Development Host.
2. Open `test/fixtures/sample.bat` in the host window.
3. Confirm a ▶ and 💾 icon appear at the editor's top-right.
4. Click ▶. Confirm a terminal "BatRunner: sample.bat" opens, echoes the
   command, prints the lines and `Done.`, then `[exit code: 0]`, and stays open.
5. Click 💾. Confirm an info message shows a path under
   `test/fixtures/batRunnerLogs/sample.<timestamp>.txt`; click "Open File" and
   confirm the header (Script/Command/Started/Exit) plus the output are correct.
6. Run ▶ again, then right-click the terminal → "BatRunner: Clear Terminal"
   (or `Ctrl+Alt+L`). Scroll up: nothing should remain (scrollback cleared).
7. Command Palette → "BatRunner: Run in External CMD": an external CMD window
   opens, runs the script, stays open, and a warning notes output can't be
   exported in that mode.
