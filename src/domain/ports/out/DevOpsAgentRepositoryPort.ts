import { DevOpsAgentsFile } from '../../models/devopsAgents';

export interface DevOpsAgentRepositoryPort {
  // Reads/writes the roster at .specify/devops-agents.yaml (DEFAULT_DEVOPS_AGENTS when absent).
  getAgents(workspacePath: string): Promise<DevOpsAgentsFile>;
  saveAgents(workspacePath: string, file: DevOpsAgentsFile): Promise<void>;
}
