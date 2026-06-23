export type SpecifyRunResult = { code: number; output: string };

export interface SpecifyCliPort {
  // True when the `specify` CLI is available — preferring the workspace's local
  // venv, then PATH (or an explicit SPECIFY_BIN).
  isAvailable(workspacePath?: string): Promise<boolean>;
  // Runs `specify <args>` in the workspace, capturing combined stdout/stderr.
  run(workspacePath: string, args: string[]): Promise<SpecifyRunResult>;
  // Installs the `specify` CLI itself via `uv tool install` from the spec-kit
  // GitHub source zip (no git required), capturing combined stdout/stderr.
  // Resolves `uv` from the workspace's local venv when present.
  installCli(workspacePath: string): Promise<SpecifyRunResult>;
}
