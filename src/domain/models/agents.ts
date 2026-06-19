import { AgentConfig, AgentType } from './types';

// A persisted, user-managed agent profile. Superset of AgentConfig with an
// identity, a display name, and the MCP servers assigned to it.
export type AgentProfile = {
  id: string;
  name: string;
  agentType: AgentType;
  agentPath?: string;
  customCommand?: string;
  model?: string;
  mcpServerIds?: string[]; // ids of McpServer assigned to this agent
  enabled?: boolean;
  description?: string;
};

export type AgentsFile = {
  agents: AgentProfile[];
  activeAgentId?: string | null;
};

export const DEFAULT_AGENTS: AgentsFile = {
  agents: [
    {
      id: 'claude-default',
      name: 'Claude (Default)',
      agentType: 'claude',
      model: 'claude-sonnet',
      enabled: true,
      mcpServerIds: [],
      description: 'Default Anthropic Claude CLI agent.',
    },
  ],
  activeAgentId: 'claude-default',
};

// Reduce a profile to the AgentConfig the runner/phase API consumes.
export function toAgentConfig(p: AgentProfile): AgentConfig {
  return {
    agentType: p.agentType,
    agentPath: p.agentPath || undefined,
    customCommand: p.customCommand || undefined,
    model: p.model || undefined,
  };
}

// Resolve the active profile (falls back to the first agent, then nothing).
export function activeAgent(file: AgentsFile): AgentProfile | null {
  if (file.agents.length === 0) return null;
  return file.agents.find(a => a.id === file.activeAgentId) || file.agents[0];
}
