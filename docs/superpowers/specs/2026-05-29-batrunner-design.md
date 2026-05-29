# BatRunner 設計文件

- **日期**：2026-05-29
- **狀態**：設計已確認，待寫實作計畫
- **類型**：VSCode 外掛（Extension）

---

## 1. 目標

提供一個 VSCode 外掛：當使用者開啟 `.bat` / `.cmd` 檔時，編輯器右上角出現執行按鈕，可依檔案所在位置一鍵執行；執行在 VSCode 內建終端機中進行、跑完不自動關閉，並可將輸出（含標頭資訊）一鍵或自動匯出成 UTF-8 文字檔。

### 核心價值
現有的 `Code Runner` 外掛已涵蓋「右上角執行鈕、依位置執行、終端機跑完不關」。本專案唯一且明確的差異點是 **擷取輸出並匯出成檔案**。整個架構環繞此目標設計。

### v1 範圍
- 僅支援 `.bat` / `.cmd`。`.ps1` / `.sh` 不在 v1 範圍（未來再擴充）。
- 平台：Windows（繁體中文環境為主要目標）。

---

## 2. 關鍵技術決策（架構基石）

### 2.1 自己掌控 process I/O，不用 `sendText`
VSCode 外掛 **無法讀回整合式終端機畫面上的文字**。若用 `terminal.sendText()` 叫終端機跑腳本，就拿不到輸出，匯出功能無法實作。

因此採用 `vscode.Pseudoterminal`：外掛自行 `child_process.spawn` 執行腳本，把 stdout/stderr 同時 (a) 畫到偽終端機畫面、(b) 累積進記憶體 buffer。誰掌握 stdout，誰才拿得到文字。

### 2.2 編碼必須對「原始 bytes」解碼
繁中 Windows 的 cmd 輸出通常是 cp950 / Big5。spawn 時 **不可設 `encoding` 選項**（否則 Node 會先用 UTF-8 解錯，無法復原），必須取得 raw `Buffer`，再用 `iconv-lite` 以正確代碼頁解碼成字串。畫面顯示與匯出檔皆使用此解碼結果；匯出檔一律存為 UTF-8。

### 2.3 真正清空終端機（含 scrollback）
`cls` / `clear` 只送 `ESC[2J`（清可見畫面），往上捲動仍會看到歷史。xterm.js（VSCode 終端機底層）支援 `ESC[3J`（清 scrollback）。因偽終端機完全由本外掛掌控，清理動作 fire `\x1b[2J\x1b[3J\x1b[H`，可保證畫面與歷史一併清空，往上捲為空。

---

## 3. 元件設計

每個元件單一職責、介面清楚、可獨立測試。

```
batrunner/
  package.json          外掛 manifest：指令 / 選單 / 設定 / activationEvents
  src/
    extension.ts        啟動進入點，註冊指令、綁定按鈕
    runner.ts           Pseudoterminal + spawn + 抓輸出（核心）
    exporter.ts         組標頭與內容、算檔名、建資料夾、寫 UTF-8 檔
    encoding.ts         iconv-lite 解碼輔助
    config.ts           讀取使用者設定
  test/
    exporter.test.ts    檔名 / 標頭格式 / 路徑組合
    encoding.test.ts    cp950 bytes → 正確中文字串
  esbuild.js            打包設定
  tsconfig.json
  .vscode/launch.json   F5 啟動 Extension Development Host
  README.md
```

| 元件 | 職責 | 依賴 |
|------|------|------|
| `extension.ts` | `activate()` 中註冊 `run` / `export` / `runExternal` / `clear` 四個指令，綁定右上角按鈕與選單貢獻 | vscode API |
| `runner.ts` | 建立 Pseudoterminal、`spawn('cmd', ['/c', file], {cwd})`、取 raw stdout/stderr → 解碼 → 顯示 + 存 buffer → 退出時寫 exit code → 儲存 `lastRun` 結果 | encoding、config |
| `exporter.ts` | 由 `lastRun` 組標頭 + 輸出、計算檔名、建立 `batRunnerLogs/`、寫出 UTF-8（可加 BOM）檔 | config |
| `encoding.ts` | `decode(buf: Buffer, codepage: string): string`，封裝 iconv-lite | iconv-lite |
| `config.ts` | 讀取 `batRunner.*` 設定，提供型別化存取 | vscode API |

### 依賴套件
- `iconv-lite`：cp950 解碼
- `esbuild`：打包外掛
- `@vscode/test-electron` + mocha：整合測試

---

## 4. 指令與 UI

| 指令 ID | 顯示位置 | 圖示 | 行為 |
|---------|----------|------|------|
| `batRunner.run` | 編輯器右上角（`editor/title`） | ▶ 播放 | 在內建終端機執行，可擷取輸出、可匯出 |
| `batRunner.exportLast` | 編輯器右上角（`editor/title`） | 💾 存檔 | 手動匯出上次執行輸出成 `.txt` |
| `batRunner.runExternal` | 命令面板 | —（無按鈕） | 彈出外部 CMD 視窗（`cmd /k`），跑完不關。**無法匯出**，呼叫匯出時明確提示 |
| `batRunner.clear` | 終端機右鍵選單（`terminal/context`）＋ 快捷鍵 `Ctrl+Alt+L` ＋ 命令面板 | 🧹 | fire `\x1b[2J\x1b[3J\x1b[H` 清空畫面與 scrollback |

### `when` 子句
右上角按鈕僅在 BAT 檔出現：
```
resourceExtname == .bat || resourceExtname == .cmd
```

### 按鈕位置說明
VSCode 不開放外掛在終端機面板「內建工具列」塞自訂按鈕。外掛可用的位置僅有：編輯器標題列、終端機右鍵選單、快捷鍵、命令面板。因此「清理」放在終端機右鍵選單（最自然）＋快捷鍵＋命令面板。

---

## 5. 資料流

### 內建執行模式（`batRunner.run`）
```
按 ▶ → run(file)
  → 取得 / 重用 名為「BatRunner: <檔名>」的 Pseudoterminal
  → （重用時）先 fire \x1b[2J\x1b[3J\x1b[H 清空
  → spawn cmd /c "<file>"  (cwd = file 所在資料夾)
  → stdout / stderr 取 raw Buffer
      → encoding.decode(buf, 設定代碼頁) → 字串
          ├─ writeEmitter.fire(字串) → 畫到終端機畫面
          └─ append 到 outputBuffer
  → process 'exit' (code)
      → 畫面與 buffer 補一行 [exit code: <code>]
      → 儲存 lastRun = { file, command, startTime, exitCode, text }
      → 若 batRunner.autoSave === true → exporter.save(lastRun)
  → 終端機保持開啟（Pseudoterminal 不自行關閉）
```

### 手動匯出（`batRunner.exportLast`）
```
按 💾 → 若無 lastRun → 提示「尚無可匯出的執行結果」
       → exporter.save(lastRun)
       → 建立 batRunnerLogs/（若不存在）
       → 寫出 UTF-8(+BOM) 檔
       → 顯示資訊訊息「已存到 <路徑>」並提供「開啟檔案」按鈕
```

### 外部執行模式（`batRunner.runExternal`）
```
spawn detached：cmd /c start cmd /k "<file>"  (cwd = file 所在資料夾)
→ 彈出外部視窗，cmd /k 保持開啟
→ 此模式無法擷取輸出；若此後呼叫匯出 → 明確提示無輸出可匯出
```

---

## 6. 匯出檔規格

- **位置**：`<腳本所在資料夾>/batRunnerLogs/`（自動建立）
- **檔名**：`<腳本主檔名>.YYYY-MM-DD_HHmmss.txt`（秒級時間戳，避免撞名）
- **編碼**：UTF-8 + BOM（讓舊版記事本也能正確顯示中文；BOM 可由設定關閉）
- **內容格式**：
```
===== BatRunner =====
Script : C:\path\to\deploy.bat
Command: cmd /c "C:\path\to\deploy.bat"
Started: 2026-05-29 20:30:15
Exit   : 0
=====================

<完整輸出（stdout 與 stderr，依時間順序）>
```

---

## 7. 設定項（`contributes.configuration`）

| 設定鍵 | 型別 | 預設 | 說明 |
|--------|------|------|------|
| `batRunner.autoSave` | boolean | `false` | 每次執行結束自動匯出 |
| `batRunner.encoding` | string | `"cp950"` | 解碼用代碼頁（繁中 Windows 用 cp950） |
| `batRunner.logFolderName` | string | `"batRunnerLogs"` | log 子資料夾名稱 |
| `batRunner.utf8Bom` | boolean | `true` | 匯出檔是否加 UTF-8 BOM |
| `batRunner.terminalMode` | enum `"integrated"` \| `"external"` | `"integrated"` | 預設執行地點 |

---

## 8. 錯誤處理與邊角情況

- **檔案有未存變更**：執行前自動存檔（避免跑到舊內容）。
- **路徑含空格**：一律以引號包住傳給 cmd。
- **spawn 失敗**：在終端機印出錯誤並跳出錯誤訊息，不靜默忽略。
- **`batRunnerLogs` 寫入失敗（權限不足等）**：跳出明確錯誤訊息，不靜默吞錯。
- **外部模式呼叫匯出**：明確提示「外部 CMD 模式無輸出可匯出」。
- **重複執行同腳本**：重用同一個終端機，執行前先清空（同 `clear` 的 3J 序列），不殘留舊歷史。
- **無 `lastRun` 時匯出**：提示尚無可匯出結果。

---

## 9. 測試策略

- **單元測試**
  - `exporter`：檔名產生、標頭格式、`batRunnerLogs` 路徑組合（純函式，易測）。
  - `encoding`：餵入已知 cp950 bytes，比對解碼後的正確中文字串。
- **整合測試**（`@vscode/test-electron`）
  - 執行樣本 `.bat`，驗證：終端機已建立、log 檔已寫出、標頭與 exit code 正確、UTF-8 內容正確。
- **手動驗證**
  - F5 啟動 Extension Development Host，開啟樣本 BAT，點 ▶ 執行、💾 匯出、右鍵清理，逐一確認行為。

---

## 10. 非目標（YAGNI）

- v1 不支援 `.ps1` / `.sh`。
- 不做跨平台（macOS / Linux）。
- 不做輸出即時串流到外部視窗（外部模式僅彈窗執行，不擷取）。
- 不做執行歷史管理 UI（log 檔即歷史）。
