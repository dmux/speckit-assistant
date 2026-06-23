// An operational (DevOps) agent run on demand from the Executions view. Built-in
// agents are backed by the bundled spec-kit-devops extension; per-agent model and
// systemPrompt are passed to the agent CLI as env vars at run time.
export type DevOpsCategory = 'deploy' | 'monitor' | 'troubleshoot';

export type DevOpsAgent = {
  id: string;
  label: string;
  command: string; // slash command, e.g. "speckit.devops.deploy"
  category: DevOpsCategory;
  description?: string;
  model?: string;
  systemPrompt?: string;
  enabled: boolean;
  builtin?: boolean;
};

export type DevOpsAgentsFile = { agents: DevOpsAgent[] };

export const DEVOPS_AGENTS_EXTENSION_ID = 'devops';

export const DEFAULT_DEVOPS_AGENTS: DevOpsAgentsFile = {
  agents: [
    {
      id: 'devops-deploy',
      label: 'Deploy',
      command: 'speckit.devops.deploy',
      category: 'deploy',
      description: 'Ships the approved implementation and verifies the release.',
      enabled: true,
      builtin: true,
    },
    {
      id: 'devops-monitor',
      label: 'Monitor',
      command: 'speckit.devops.monitor',
      category: 'monitor',
      description: 'Inspects post-deploy health, metrics and logs.',
      enabled: true,
      builtin: true,
    },
    {
      id: 'devops-troubleshoot',
      label: 'Troubleshoot',
      command: 'speckit.devops.troubleshoot',
      category: 'troubleshoot',
      description: 'Diagnoses incidents and proposes remediation.',
      enabled: true,
      builtin: true,
    },
  ],
};
