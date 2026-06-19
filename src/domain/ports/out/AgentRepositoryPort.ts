import { AgentsFile } from '../../models/agents';

export interface AgentRepositoryPort {
  // Reads .specify/agents.yaml (or DEFAULT_AGENTS when absent).
  getAgents(workspacePath: string): Promise<AgentsFile>;
  // Persists the full agents file to .specify/agents.yaml.
  saveAgents(workspacePath: string, file: AgentsFile): Promise<void>;
}
