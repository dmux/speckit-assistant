// A participating agent in the specification phase. Built-in agents are backed
// by the bundled spec-kit-spec-agents extension; custom agents carry their own
// systemPrompt (written as a command file when applied).
export type SpecAgent = {
  id: string;
  label: string;
  command: string; // slash command, e.g. "speckit.spec-agents.po"
  description?: string;
  model?: string;
  systemPrompt?: string; // used for custom agents
  enabled: boolean;
  optional: boolean; // false = mandatory (auto-executed) hook
  priority: number; // lower runs first
  builtin?: boolean;
};

export type SpecAgentsFile = { agents: SpecAgent[] };

export const SPEC_AGENTS_EXTENSION_ID = 'spec-agents';

export const DEFAULT_SPEC_AGENTS: SpecAgentsFile = {
  agents: [
    { id: 'spec-po', label: 'Product Owner', command: 'speckit.spec-agents.po', description: 'Business value, scope and acceptance criteria.', enabled: true, optional: true, priority: 10, builtin: true },
    { id: 'spec-architecture', label: 'Architecture', command: 'speckit.spec-agents.architecture', description: 'Technical risks, NFRs and constraints.', enabled: true, optional: true, priority: 20, builtin: true },
    { id: 'spec-refine', label: 'Technical Refinement', command: 'speckit.spec-agents.refine', description: 'Requirement clarity, ambiguities and testability.', enabled: true, optional: true, priority: 30, builtin: true },
    { id: 'spec-consolidate', label: 'Consolidate (Lead)', command: 'speckit.spec-agents.consolidate', description: 'Merge contributions into spec.md.', enabled: true, optional: true, priority: 90, builtin: true },
  ],
};
