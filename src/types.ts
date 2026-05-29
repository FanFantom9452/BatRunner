export interface RunResult {
  scriptPath: string;
  command: string;
  startTime: Date;
  exitCode: number | null;
  output: string;
}
