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
