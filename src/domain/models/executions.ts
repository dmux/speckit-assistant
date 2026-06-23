import { WorkflowPhase, CostMetadata } from './types';

// Every tracked agent run that this process orchestrates: a workflow phase, a
// review-gate persona, or an on-demand DevOps agent. (Spec-agent hook runs happen
// inside the specify CLI subprocess and are not individually tracked here.)
export type ExecutionKind = 'phase' | 'persona' | 'devops';

export type ExecutionStatus =
  | 'running' // process spawned, not yet exited
  | 'passed'  // clean/verdict pass
  | 'failed'; // non-zero exit / verdict fail

// A persisted record of one agent run. Stored append-only as JSONL; a run writes a
// 'running' snapshot at start and a patch at finish, merged by id on read.
export type ExecutionRecord = {
  id: string;
  kind: ExecutionKind;
  feature: string | null;
  phase?: WorkflowPhase;
  agentId?: string; // persona id or devops agent id
  label: string;
  command?: string;
  status: ExecutionStatus;
  startedAt: number; // epoch ms
  seq?: number; // monotonic per-process tiebreaker for runs started in the same ms
  completedAt?: number; // epoch ms
  exitCode?: number;
  cost?: CostMetadata;
  logPath: string; // workspace-relative path to the captured log
};

// Fields supplied when a run starts; the store assigns id/startedAt/status/logPath.
export type ExecutionStartInput = {
  kind: ExecutionKind;
  feature: string | null;
  phase?: WorkflowPhase;
  agentId?: string;
  label: string;
  command?: string;
};

export type ExecutionFinishPatch = {
  status: ExecutionStatus;
  exitCode?: number;
  cost?: CostMetadata;
};
