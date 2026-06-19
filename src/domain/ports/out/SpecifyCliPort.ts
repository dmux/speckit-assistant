export type SpecifyRunResult = { code: number; output: string };

export interface SpecifyCliPort {
  // True when the `specify` CLI is available on PATH (or via SPECIFY_BIN).
  isAvailable(): Promise<boolean>;
  // Runs `specify <args>` in the workspace, capturing combined stdout/stderr.
  run(workspacePath: string, args: string[]): Promise<SpecifyRunResult>;
}
