export type WorkflowPhase =
  | 'constitution'
  | 'specification'
  | 'clarification'
  | 'planning'
  | 'checklist'
  | 'analyze'
  | 'tasks'
  | 'taskstoissues'
  | 'implementation';

export type PhaseStatus =
  | 'idle'             // not yet started
  | 'running'          // command sent, waiting for agent to generate file
  | 'awaiting_review'  // file appeared on disk / task run completed, waiting for review
  | 'approved';        // user approved, phase complete

export type PersonaId = 'qa' | 'code-review' | 'security' | 'tech-lead';

export type PersonaRunStatus =
  | 'idle'      // not yet run in the current gate
  | 'running'   // persona agent is executing
  | 'passed'    // review report exists with VERDICT: PASS (or clean exit)
  | 'failed';   // VERDICT: FAIL or non-zero exit — gate stops here

// Model/CLI-agnostic cost & usage captured for a single agent run. Token/cost
// figures are best-effort: 'parsed' when the CLI printed them, otherwise
// 'estimated' from I/O volume × a pricing table. durationMs is always exact.
export type CostMetadata = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUSD?: number;
  model?: string;
  durationMs?: number;
  source: 'parsed' | 'estimated';
};

// A persona's runtime state within the implementation review gate.
export type PersonaState = {
  id: PersonaId;
  status: PersonaRunStatus;
  reportPath?: string | null; // specs/<feature>/reviews/<persona>.md
  cost?: CostMetadata;        // captured cost/usage of the persona's run
};

// User-configurable definition of a persona (which slash command backs it).
export type PersonaConfig = {
  id: PersonaId;
  label: string;    // "QA", "Code Review", "Security", "Tech Lead"
  command: string;  // extension slash command, e.g. "/speckit.personas.qa"
  enabled: boolean;
  model?: string;
  systemPrompt?: string;
  capabilities?: string[];
  tools?: string[];
  description?: string;
};

// A single markdown file within a phase. Used when a phase resolves to a
// directory of files (e.g. spec-kit emits specs/<feature>/checklist/ with
// multiple .md files) instead of a single file.
export type PhaseFile = {
  path: string;
  content: string;
};

export type PhaseState = {
  phase: WorkflowPhase;
  status: PhaseStatus;
  filePath: string | null;
  content: string | null;
  // Populated when the phase is a directory of .md files. filePath/content
  // point at the first file; files lists all of them.
  files?: PhaseFile[];
  stale?: boolean;
  // Only populated for the implementation phase: the review gate's per-persona state.
  personas?: PersonaState[];
  // Captured cost/usage of the last agent run for this phase.
  cost?: CostMetadata;
};

export type FeatureWorkflow = {
  name: string;
  phases: PhaseState[];
};

export type WorkflowState = {
  constitutionPhase: PhaseState;
  features: FeatureWorkflow[];
  activeFeatureName: string | null;
};

export type AgentType = 'claude' | 'gemini' | 'copilot' | 'openai' | 'custom';

export type AgentConfig = {
  agentType: AgentType;
  customCommand?: string;
  agentPath?: string;
  // Optional model hint used only for cost pricing of phase runs. When absent,
  // a default model is assumed per agentType (see pricing.ts).
  model?: string;
};
