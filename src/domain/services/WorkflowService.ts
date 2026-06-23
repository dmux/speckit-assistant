import { WorkflowUseCases } from '../ports/in/WorkflowUseCases';
import { WorkspaceRepositoryPort } from '../ports/out/WorkspaceRepositoryPort';
import { AgentRunnerPort } from '../ports/out/AgentRunnerPort';
import { ExecutionHistoryPort } from '../ports/out/ExecutionHistoryPort';
import {
  WorkflowState,
  WorkflowPhase,
  AgentConfig,
  FeatureWorkflow,
  PhaseState,
  PersonaConfig,
  PersonaId,
  PersonaRunStatus,
  CostMetadata,
} from '../models/types';
import { ExecutionStartInput, ExecutionStatus } from '../models/executions';
import { DevOpsAgent } from '../models/devopsAgents';
import { orderPersonas, personaReportPath } from '../models/personas';

const FEATURE_PHASES: WorkflowPhase[] = [
  'specification',
  'clarification',
  'planning',
  'checklist',
  'analyze',
  'tasks',
  'taskstoissues',
  'implementation'
];

export class WorkflowService implements WorkflowUseCases {
  constructor(
    private workspaceRepo: WorkspaceRepositoryPort,
    private agentRunner: AgentRunnerPort,
    private executionHistory: ExecutionHistoryPort
  ) {}

  // Wraps an agent run with execution-history tracking: records a 'running' entry,
  // tees the run's output to its log file, then persists the terminal status/exit/cost.
  // Returns the exit code, captured cost, and resolved status.
  private async recordRun(
    workspacePath: string,
    meta: ExecutionStartInput,
    onData: ((text: string) => void) | undefined,
    run: (onData: (text: string) => void, onCost: (cost: CostMetadata) => void) => Promise<number>,
    resolveStatus?: (exitCode: number) => Promise<ExecutionStatus> | ExecutionStatus
  ): Promise<{ exitCode: number; cost?: CostMetadata; status: ExecutionStatus }> {
    const record = await this.executionHistory.start(workspacePath, meta);
    const tee = (text: string) => {
      this.executionHistory.appendLog(workspacePath, record.id, text);
      onData?.(text);
    };
    let cost: CostMetadata | undefined;
    let exitCode = 1;
    try {
      exitCode = await run(tee, (c) => { cost = c; });
      const status: ExecutionStatus = resolveStatus
        ? await resolveStatus(exitCode)
        : exitCode === 0 ? 'passed' : 'failed';
      await this.executionHistory.finish(workspacePath, record.id, { status, exitCode, cost });
      return { exitCode, cost, status };
    } catch (err) {
      await this.executionHistory.finish(workspacePath, record.id, { status: 'failed', exitCode, cost });
      throw err;
    }
  }

  async getWorkflowState(workspacePath: string): Promise<WorkflowState> {
    const state = await this.workspaceRepo.getWorkflowState(workspacePath);
    return state;
  }

  async createFeature(workspacePath: string, name: string): Promise<WorkflowState> {
    const state = await this.workspaceRepo.createFeature(workspacePath, name);
    state.activeFeatureName = name;
    await this.workspaceRepo.saveWorkflowState(workspacePath, state);
    return state;
  }

  async deleteFeature(workspacePath: string, name: string): Promise<WorkflowState> {
    const state = await this.workspaceRepo.deleteFeature(workspacePath, name);
    return state;
  }

  async setActiveFeature(workspacePath: string, name: string): Promise<WorkflowState> {
    const state = await this.workspaceRepo.getWorkflowState(workspacePath);
    if (state.features.some(f => f.name === name)) {
      state.activeFeatureName = name;
      await this.workspaceRepo.saveWorkflowState(workspacePath, state);
    }
    return state;
  }

  async runPhase(
    workspacePath: string,
    phase: WorkflowPhase,
    featureName: string | null,
    agentConfig: AgentConfig,
    userPrompt?: string,
    onData?: (text: string) => void,
    personas?: PersonaConfig[]
  ): Promise<WorkflowState> {
    const state = await this.workspaceRepo.getWorkflowState(workspacePath);
    const targetFeature = featureName || state.activeFeatureName;

    // Set status to running
    this.setPhaseStatus(state, phase, targetFeature, 'running');
    await this.workspaceRepo.saveWorkflowState(workspacePath, state);

    try {
      const { exitCode, cost: runCost } = await this.recordRun(
        workspacePath,
        { kind: 'phase', feature: targetFeature, phase, label: phase },
        onData,
        (d, c) => this.agentRunner.runPhase(workspacePath, phase, targetFeature, agentConfig, userPrompt, d, c)
      );

      // Re-read state in case files changed on disk during run
      const freshState = await this.workspaceRepo.getWorkflowState(workspacePath);
      const runPhaseState = this.findPhase(freshState, phase, targetFeature);
      if (runPhaseState && runCost) runPhaseState.cost = runCost;

      if (exitCode !== 0) {
        this.setPhaseStatus(freshState, phase, targetFeature, 'idle');
        await this.workspaceRepo.saveWorkflowState(workspacePath, freshState);
        return freshState;
      }

      // Implementation: if a review gate is configured, the personas govern the
      // final status (only reaching awaiting_review after Tech Lead signs off).
      const enabledPersonas = (personas ?? []).filter(p => p.enabled);
      if (phase === 'implementation' && targetFeature && enabledPersonas.length > 0) {
        this.setPhaseStatus(freshState, phase, targetFeature, 'running');
        await this.workspaceRepo.saveWorkflowState(workspacePath, freshState);
        return this.runImplementationGate(workspacePath, targetFeature, agentConfig, personas!, onData);
      }

      this.setPhaseStatus(freshState, phase, targetFeature, 'awaiting_review');
      // Check if tasks are completed to auto-complete implementation
      if (phase === 'implementation') {
        await this.checkImplementationAutoReview(workspacePath, freshState, targetFeature);
      }

      await this.workspaceRepo.saveWorkflowState(workspacePath, freshState);
      return freshState;
    } catch (err) {
      const freshState = await this.workspaceRepo.getWorkflowState(workspacePath);
      this.setPhaseStatus(freshState, phase, targetFeature, 'idle');
      await this.workspaceRepo.saveWorkflowState(workspacePath, freshState);
      throw err;
    }
  }

  // Runs the implementation review gate: enabled personas execute sequentially
  // (Tech Lead last). The gate stops at the first persona that fails, leaving
  // the implementation phase 'running' (blocked). Only when every persona passes
  // does the phase advance to 'awaiting_review' for human approval.
  async runImplementationGate(
    workspacePath: string,
    featureName: string,
    agentConfig: AgentConfig,
    personas: PersonaConfig[],
    onData?: (text: string) => void
  ): Promise<WorkflowState> {
    const enabled = orderPersonas(personas.filter(p => p.enabled));

    const state = await this.workspaceRepo.getWorkflowState(workspacePath);
    const implPhase = this.findPhase(state, 'implementation', featureName);
    if (!implPhase) return state;

    implPhase.status = 'running';
    implPhase.personas = enabled.map(p => ({
      id: p.id,
      status: 'idle' as PersonaRunStatus,
      reportPath: personaReportPath(featureName, p.id),
    }));
    await this.workspaceRepo.saveWorkflowState(workspacePath, state);

    for (const persona of enabled) {
      const ps = implPhase.personas!.find(x => x.id === persona.id)!;
      ps.status = 'running';
      await this.workspaceRepo.saveWorkflowState(workspacePath, state);

      onData?.(`\r\n\x1b[36m=== Persona: ${persona.label} (${persona.command}) ===\x1b[0m\r\n`);

      const { cost: personaCost, status } = await this.recordRun(
        workspacePath,
        { kind: 'persona', feature: featureName, phase: 'implementation', agentId: persona.id, label: persona.label, command: persona.command },
        onData,
        (d, c) => this.agentRunner.runPersona(workspacePath, featureName, persona, agentConfig, d, c),
        async (exit) => (await this.resolvePersonaVerdict(workspacePath, featureName, persona.id, exit)) as ExecutionStatus
      );

      const verdict = status as PersonaRunStatus;
      ps.status = verdict;
      if (personaCost) ps.cost = personaCost;
      await this.workspaceRepo.saveWorkflowState(workspacePath, state);

      if (verdict === 'failed') {
        onData?.(`\r\n\x1b[31m✗ ${persona.label} bloqueou o gate — implementação permanece em revisão.\x1b[0m\r\n`);
        return state;
      }
      onData?.(`\r\n\x1b[32m✓ ${persona.label} passou.\x1b[0m\r\n`);
    }

    implPhase.status = 'awaiting_review';
    await this.workspaceRepo.saveWorkflowState(workspacePath, state);
    onData?.(`\r\n\x1b[32m✓ Review gate completo — pronto para aprovação.\x1b[0m\r\n`);
    return state;
  }

  // Runs an on-demand DevOps agent (deploy/monitor/troubleshoot). It does not change
  // workflow/phase state — it's an operational action, fully tracked in the execution
  // history. featureName may be null for a workspace-wide run.
  async runDevOps(
    workspacePath: string,
    agent: DevOpsAgent,
    featureName: string | null,
    agentConfig: AgentConfig,
    onData?: (text: string) => void
  ): Promise<{ exitCode: number }> {
    const { exitCode } = await this.recordRun(
      workspacePath,
      { kind: 'devops', feature: featureName, agentId: agent.id, label: agent.label, command: agent.command },
      onData,
      (d, c) => this.agentRunner.runDevOps(workspacePath, featureName, agent, agentConfig, d, c)
    );
    return { exitCode };
  }

  // A persona's verdict is read from its report (specs/<feature>/reviews/<id>.md):
  // an explicit "VERDICT: PASS|FAIL" marker wins; otherwise we fall back to the
  // process exit code. This is robust across heterogeneous agent CLIs that may
  // not control their exit code reliably.
  private async resolvePersonaVerdict(
    workspacePath: string,
    featureName: string,
    id: PersonaId,
    exitCode: number
  ): Promise<PersonaRunStatus> {
    let report = '';
    try {
      report = await this.workspaceRepo.readFile(workspacePath, personaReportPath(featureName, id));
    } catch {
      report = '';
    }
    const text = report.toUpperCase();
    if (/VERDICT:\s*FAIL/.test(text)) return 'failed';
    if (/VERDICT:\s*PASS/.test(text)) return 'passed';
    return exitCode === 0 ? 'passed' : 'failed';
  }

  async approvePhase(workspacePath: string, phase: WorkflowPhase, featureName: string | null): Promise<WorkflowState> {
    const state = await this.workspaceRepo.getWorkflowState(workspacePath);
    const targetFeature = featureName || state.activeFeatureName;

    const ps = this.findPhase(state, phase, targetFeature);
    if (ps) {
      ps.status = 'approved';
      ps.stale = false;
    }

    await this.workspaceRepo.saveWorkflowState(workspacePath, state);
    return state;
  }

  async discardPhase(workspacePath: string, phase: WorkflowPhase, featureName: string | null): Promise<WorkflowState> {
    const state = await this.workspaceRepo.getWorkflowState(workspacePath);
    const targetFeature = featureName || state.activeFeatureName;

    const ps = this.findPhase(state, phase, targetFeature);
    if (ps) {
      ps.status = 'idle';
      ps.content = null;
      ps.stale = false;
    }

    this.markDownstreamStale(state, phase, targetFeature);
    await this.workspaceRepo.saveWorkflowState(workspacePath, state);
    return state;
  }

  async toggleTask(workspacePath: string, featureName: string, lineIndex: number, checked: boolean): Promise<WorkflowState> {
    const freshState = await this.workspaceRepo.toggleTask(workspacePath, featureName, lineIndex, checked);
    await this.checkImplementationAutoReview(workspacePath, freshState, featureName);
    await this.workspaceRepo.saveWorkflowState(workspacePath, freshState);
    return freshState;
  }

  async readFile(workspacePath: string, filePath: string): Promise<string> {
    return this.workspaceRepo.readFile(workspacePath, filePath);
  }

  async writeFile(workspacePath: string, filePath: string, content: string): Promise<WorkflowState> {
    await this.workspaceRepo.writeFile(workspacePath, filePath, content);
    
    // Determine which phase/feature this file belongs to and update status to awaiting_review if not approved
    const state = await this.workspaceRepo.getWorkflowState(workspacePath);
    await this.workspaceRepo.saveWorkflowState(workspacePath, state);
    return state;
  }

  async writeStdin(phase: WorkflowPhase, featureName: string | null, text: string, personaId?: PersonaId): Promise<boolean> {
    return this.agentRunner.writeStdin(phase, featureName, text, personaId);
  }

  async resize(phase: WorkflowPhase, featureName: string | null, cols: number, rows: number, personaId?: PersonaId): Promise<boolean> {
    return this.agentRunner.resize(phase, featureName, cols, rows, personaId);
  }

  async stop(phase: WorkflowPhase, featureName: string | null, personaId?: PersonaId): Promise<boolean> {
    return this.agentRunner.stop(phase, featureName, personaId);
  }

  // Helper methods
  private findPhase(state: WorkflowState, phase: WorkflowPhase, featureName: string | null): PhaseState | null {
    if (phase === 'constitution') {
      return state.constitutionPhase;
    }
    const feature = state.features.find(f => f.name === featureName);
    if (!feature) return null;
    return feature.phases.find(p => p.phase === phase) || null;
  }

  private setPhaseStatus(state: WorkflowState, phase: WorkflowPhase, featureName: string | null, status: any) {
    const ps = this.findPhase(state, phase, featureName);
    if (ps) {
      ps.status = status;
    }
  }

  private markDownstreamStale(state: WorkflowState, discarded: WorkflowPhase, featureName: string | null) {
    if (discarded === 'constitution') {
      for (const feature of state.features) {
        for (const p of feature.phases) {
          if (p.status === 'approved') p.stale = true;
        }
      }
      return;
    }

    const feature = state.features.find(f => f.name === featureName);
    if (!feature) return;

    const idx = FEATURE_PHASES.indexOf(discarded);
    if (idx === -1) return;

    for (let i = idx + 1; i < FEATURE_PHASES.length; i++) {
      const later = feature.phases.find(p => p.phase === FEATURE_PHASES[i]);
      if (later && later.status === 'approved') {
        later.stale = true;
      }
    }
  }

  private async checkImplementationAutoReview(workspacePath: string, state: WorkflowState, featureName: string | null) {
    const feature = state.features.find(f => f.name === featureName);
    if (!feature) return;

    const tasksPhase = feature.phases.find(p => p.phase === 'tasks');
    const implPhase = feature.phases.find(p => p.phase === 'implementation');

    if (!tasksPhase?.filePath || !implPhase) return;

    try {
      const content = await this.workspaceRepo.readFile(workspacePath, tasksPhase.filePath);
      const checkboxes = [...content.matchAll(/^\s*(?:[-*]|\d+\.)\s+\[( |x|X)\]/gm)];
      if (checkboxes.length > 0 && checkboxes.every(c => c[1].toLowerCase() === 'x')) {
        if (implPhase.status === 'running' || implPhase.status === 'idle') {
          implPhase.status = 'awaiting_review';
        }
      }
    } catch {
      // ignore
    }
  }
}
