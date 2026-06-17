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

// A persona's runtime state within the implementation review gate.
export type PersonaState = {
  id: PersonaId;
  status: PersonaRunStatus;
  reportPath?: string | null; // specs/<feature>/reviews/<persona>.md
};

// User-configurable definition of a persona (which slash command backs it).
export type PersonaConfig = {
  id: PersonaId;
  label: string;    // "QA", "Code Review", "Security", "Tech Lead"
  command: string;  // extension slash command, e.g. "/speckit.review.qa"
  enabled: boolean;
  model?: string;
  systemPrompt?: string;
  capabilities?: string[];
  tools?: string[];
  description?: string;
};

export type PhaseState = {
  phase: WorkflowPhase;
  status: PhaseStatus;
  filePath: string | null;
  content: string | null;
  stale?: boolean;
  // Only populated for the implementation phase: the review gate's per-persona state.
  personas?: PersonaState[];
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
};
