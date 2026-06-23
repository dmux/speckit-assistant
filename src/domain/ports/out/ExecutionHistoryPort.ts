import {
  ExecutionRecord,
  ExecutionStartInput,
  ExecutionFinishPatch,
} from '../../models/executions';

export interface ExecutionHistoryPort {
  // Create a 'running' record (assigns id/startedAt/logPath) and persist it.
  start(workspacePath: string, input: ExecutionStartInput): Promise<ExecutionRecord>;
  // Append captured output to the run's log file (best-effort).
  appendLog(workspacePath: string, id: string, text: string): void;
  // Persist the terminal status/exit/cost for a run.
  finish(workspacePath: string, id: string, patch: ExecutionFinishPatch): Promise<void>;
  // All records (merged), optionally filtered by feature, newest first.
  list(workspacePath: string, filter?: { feature?: string }): Promise<ExecutionRecord[]>;
  // The captured log text for a run ('' when absent).
  readLog(workspacePath: string, id: string): Promise<string>;
}
