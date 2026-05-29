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
