import { SpecAgentsFile } from '../../models/specAgents';

export type SpecAgentApplyResult = {
  path: string; // the .specify/extensions.yml that was written
  hookCount: number;
  customWritten: string[]; // command files written for custom agents
};

export interface SpecAgentRepositoryPort {
  // Reads/writes the roster at .specify/spec-agents.yaml (DEFAULT_SPEC_AGENTS when absent).
  getAgents(workspacePath: string): Promise<SpecAgentsFile>;
  saveAgents(workspacePath: string, file: SpecAgentsFile): Promise<void>;
  // Projects the enabled agents into .specify/extensions.yml hooks.after_specify
  // (merge-preserving) and writes command files for custom agents.
  applyToSpecKit(workspacePath: string, file: SpecAgentsFile): Promise<SpecAgentApplyResult>;
}
