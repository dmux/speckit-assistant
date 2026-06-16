import { WorkflowPhase, AgentConfig } from '../../models/types';

export interface AgentRunnerPort {
  runPhase(
    workspacePath: string,
    phase: WorkflowPhase,
    featureName: string | null,
    agentConfig: AgentConfig,
    userPrompt?: string,
    onData?: (text: string) => void
  ): Promise<number>;
  writeStdin(
    phase: WorkflowPhase,
    featureName: string | null,
    text: string
  ): Promise<boolean>;
}
