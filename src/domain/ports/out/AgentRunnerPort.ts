import { WorkflowPhase, AgentConfig, PersonaConfig, PersonaId, CostMetadata } from '../../models/types';

export interface AgentRunnerPort {
  runPhase(
    workspacePath: string,
    phase: WorkflowPhase,
    featureName: string | null,
    agentConfig: AgentConfig,
    userPrompt?: string,
    onData?: (text: string) => void,
    // Invoked once at process exit with the captured cost/usage of the run.
    onCost?: (cost: CostMetadata) => void
  ): Promise<number>;
  // Runs a single review-gate persona as its own tracked CLI process.
  runPersona(
    workspacePath: string,
    featureName: string,
    persona: PersonaConfig,
    agentConfig: AgentConfig,
    onData?: (text: string) => void,
    onCost?: (cost: CostMetadata) => void
  ): Promise<number>;
  // personaId targets a running persona process; omit it to target the phase process.
  writeStdin(
    phase: WorkflowPhase,
    featureName: string | null,
    text: string,
    personaId?: PersonaId
  ): Promise<boolean>;
  resize(
    phase: WorkflowPhase,
    featureName: string | null,
    cols: number,
    rows: number,
    personaId?: PersonaId
  ): Promise<boolean>;
  stop(
    phase: WorkflowPhase,
    featureName: string | null,
    personaId?: PersonaId
  ): Promise<boolean>;
}
