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

export type PhaseState = {
  phase: WorkflowPhase;
  status: PhaseStatus;
  filePath: string | null;
  content: string | null;
  stale?: boolean;
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
