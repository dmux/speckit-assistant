import { McpFile } from '../../models/mcp';
import { AgentProfile } from '../../models/agents';

// Result of applying an agent's assigned MCP servers to its CLI's native config.
export type McpApplyResult = {
  agentType: string;
  path: string; // the native config file written
  serverCount: number;
  notes: string[];
};

export interface McpConfigPort {
  // Reads/writes our central server list at .specify/mcp.yaml.
  getServers(workspacePath: string): Promise<McpFile>;
  saveServers(workspacePath: string, file: McpFile): Promise<void>;
  // Translates the agent's enabled+assigned servers into the CLI's native
  // config format and merges them into the target file (preserving existing).
  applyToAgent(workspacePath: string, agent: AgentProfile, file: McpFile): Promise<McpApplyResult>;
}
