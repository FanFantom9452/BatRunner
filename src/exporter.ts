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
