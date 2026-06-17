import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowService } from './WorkflowService';
import { WorkspaceRepositoryPort } from '../ports/out/WorkspaceRepositoryPort';
import { AgentRunnerPort } from '../ports/out/AgentRunnerPort';
import { WorkflowState, FeatureWorkflow } from '../models/types';
import { DEFAULT_PERSONAS } from '../models/personas';

describe('WorkflowService', () => {
  let workspaceRepo: vi.Mocked<WorkspaceRepositoryPort>;
  let agentRunner: vi.Mocked<AgentRunnerPort>;
  let service: WorkflowService;

  const mockState: WorkflowState = {
    constitutionPhase: { phase: 'constitution', status: 'approved', filePath: '/path/constitution.md', content: '' },
    features: [
      {
        name: 'auth',
        phases: [
          { phase: 'specification', status: 'approved', filePath: '/path/spec.md', content: '' },
          { phase: 'planning', status: 'approved', filePath: '/path/plan.md', content: '' },
          { phase: 'tasks', status: 'approved', filePath: '/path/tasks.md', content: '- [x] task 1\n- [ ] task 2' },
          { phase: 'implementation', status: 'idle', filePath: null, content: null }
        ]
      }
    ],
    activeFeatureName: 'auth'
  };

  beforeEach(() => {
    workspaceRepo = {
      getWorkflowState: vi.fn().mockResolvedValue(JSON.parse(JSON.stringify(mockState))),
      saveWorkflowState: vi.fn().mockResolvedValue(undefined),
      toggleTask: vi.fn(),
      createFeature: vi.fn(),
      deleteFeature: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn()
    } as any;

    agentRunner = {
      runPhase: vi.fn(),
      stop: vi.fn()
    } as any;

    service = new WorkflowService(workspaceRepo, agentRunner);
  });

  it('should fetch workflow state', async () => {
    const state = await service.getWorkflowState('/workspace');
    expect(state.activeFeatureName).toBe('auth');
    expect(workspaceRepo.getWorkflowState).toHaveBeenCalledWith('/workspace');
  });

  it('should set phase to approved', async () => {
    const state = await service.approvePhase('/workspace', 'implementation', 'auth');
    const authFeature = state.features.find(f => f.name === 'auth')!;
    const implPhase = authFeature.phases.find(p => p.phase === 'implementation')!;
    expect(implPhase.status).toBe('approved');
    expect(workspaceRepo.saveWorkflowState).toHaveBeenCalled();
  });

  it('should discard phase and mark downstream phases as stale', async () => {
    // Set downstream phases to approved so they can become stale
    const stateWithApprovedPhases: WorkflowState = JSON.parse(JSON.stringify(mockState));
    const authFeatureMock = stateWithApprovedPhases.features[0];
    authFeatureMock.phases.forEach(p => p.status = 'approved');
    workspaceRepo.getWorkflowState.mockResolvedValue(stateWithApprovedPhases);

    // Discard specification phase
    const state = await service.discardPhase('/workspace', 'specification', 'auth');
    const authFeature = state.features.find(f => f.name === 'auth')!;
    
    // Specification should be idle
    const spec = authFeature.phases.find(p => p.phase === 'specification')!;
    expect(spec.status).toBe('idle');

    // Planning, tasks, implementation should be stale
    const plan = authFeature.phases.find(p => p.phase === 'planning')!;
    const tasks = authFeature.phases.find(p => p.phase === 'tasks')!;
    const impl = authFeature.phases.find(p => p.phase === 'implementation')!;

    expect(plan.stale).toBe(true);
    expect(tasks.stale).toBe(true);
    expect(impl.stale).toBe(true);
  });

  it('should auto-complete implementation when all tasks are checked', async () => {
    const completedTasksState: WorkflowState = JSON.parse(JSON.stringify(mockState));
    // Set all tasks checked in mock file content
    const tasksPhase = completedTasksState.features[0].phases.find(p => p.phase === 'tasks')!;
    tasksPhase.filePath = '/path/tasks.md';
    
    workspaceRepo.getWorkflowState.mockResolvedValue(completedTasksState);
    workspaceRepo.toggleTask.mockResolvedValue(completedTasksState);
    workspaceRepo.readFile.mockResolvedValue('- [x] task 1\n- [x] task 2');

    const state = await service.toggleTask('/workspace', 'auth', 1, true);
    
    const authFeature = state.features.find(f => f.name === 'auth')!;
    const implPhase = authFeature.phases.find(p => p.phase === 'implementation')!;
    expect(implPhase.status).toBe('awaiting_review');
  });

  it('should handle agent run errors, reverting phase status to idle', async () => {
    const errorMsg = 'Agent execution crash';
    agentRunner.runPhase.mockRejectedValue(new Error(errorMsg));

    await expect(
      service.runPhase('/workspace', 'specification', 'auth', { agentType: 'claude' })
    ).rejects.toThrow(errorMsg);

    expect(workspaceRepo.saveWorkflowState).toHaveBeenCalled();
  });

  it('should handle non-zero exit code, setting status back to idle', async () => {
    agentRunner.runPhase.mockResolvedValue(1);

    const state = await service.runPhase('/workspace', 'specification', 'auth', { agentType: 'claude' });
    const authFeature = state.features.find(f => f.name === 'auth')!;
    const specPhase = authFeature.phases.find(p => p.phase === 'specification')!;
    expect(specPhase.status).toBe('idle');
  });

  it('should auto-review implementation phase upon completion inside runPhase', async () => {
    agentRunner.runPhase.mockResolvedValue(0);
    workspaceRepo.readFile.mockResolvedValue('- [x] task 1\n- [x] task 2');

    const runningState: WorkflowState = JSON.parse(JSON.stringify(mockState));
    const tasksPhase = runningState.features[0].phases.find(p => p.phase === 'tasks')!;
    tasksPhase.filePath = '/path/tasks.md';
    const implPhaseMock = runningState.features[0].phases.find(p => p.phase === 'implementation')!;
    implPhaseMock.status = 'running';

    workspaceRepo.getWorkflowState.mockResolvedValue(runningState);

    const state = await service.runPhase('/workspace', 'implementation', 'auth', { agentType: 'claude' });
    const authFeature = state.features.find(f => f.name === 'auth')!;
    const implPhase = authFeature.phases.find(p => p.phase === 'implementation')!;
    expect(implPhase.status).toBe('awaiting_review');
  });

  it('should approve and discard constitution phase, propagating staleness', async () => {
    // Approve constitution
    const stateApproved = await service.approvePhase('/workspace', 'constitution', null);
    expect(stateApproved.constitutionPhase.status).toBe('approved');

    // Make all feature phases approved
    const stateWithApprovedPhases: WorkflowState = JSON.parse(JSON.stringify(mockState));
    stateWithApprovedPhases.features[0].phases.forEach(p => {
      p.status = 'approved';
    });
    workspaceRepo.getWorkflowState.mockResolvedValue(stateWithApprovedPhases);

    // Discard constitution
    const stateDiscarded = await service.discardPhase('/workspace', 'constitution', null);
    expect(stateDiscarded.constitutionPhase.status).toBe('idle');
    
    // All downstream feature phases must become stale
    const authFeature = stateDiscarded.features.find(f => f.name === 'auth')!;
    authFeature.phases.forEach(p => {
      expect(p.stale).toBe(true);
    });
  });

  it('should handle file reading errors in checkImplementationAutoReview gracefully', async () => {
    const completedTasksState: WorkflowState = JSON.parse(JSON.stringify(mockState));
    const tasksPhase = completedTasksState.features[0].phases.find(p => p.phase === 'tasks')!;
    tasksPhase.filePath = '/path/tasks.md';
    
    workspaceRepo.getWorkflowState.mockResolvedValue(completedTasksState);
    workspaceRepo.toggleTask.mockResolvedValue(completedTasksState);
    
    // Mock readFile to reject
    workspaceRepo.readFile.mockRejectedValue(new Error('File access error'));

    const state = await service.toggleTask('/workspace', 'auth', 1, true);
    expect(state).toBeDefined();
    // Implementation status remains idle instead of throwing
    const authFeature = state.features.find(f => f.name === 'auth')!;
    const implPhase = authFeature.phases.find(p => p.phase === 'implementation')!;
    expect(implPhase.status).toBe('idle');
  });

  describe('implementation review gate', () => {
    const gateState = (): WorkflowState => {
      const s: WorkflowState = JSON.parse(JSON.stringify(mockState));
      const impl = s.features[0].phases.find(p => p.phase === 'implementation')!;
      impl.status = 'running';
      return s;
    };

    it('runs personas in order and advances to awaiting_review when all pass', async () => {
      workspaceRepo.getWorkflowState.mockResolvedValue(gateState());
      workspaceRepo.readFile.mockResolvedValue('looks good\n\nVERDICT: PASS');
      const order: string[] = [];
      agentRunner.runPersona = vi.fn().mockImplementation(
        (_w: string, _f: string, persona: any) => {
          order.push(persona.id);
          return Promise.resolve(0);
        }
      );

      const state = await service.runImplementationGate(
        '/workspace',
        'auth',
        { agentType: 'claude' },
        DEFAULT_PERSONAS
      );

      expect(order).toEqual(['qa', 'code-review', 'security', 'tech-lead']);
      const impl = state.features[0].phases.find(p => p.phase === 'implementation')!;
      expect(impl.status).toBe('awaiting_review');
      expect(impl.personas?.map(p => p.status)).toEqual(['passed', 'passed', 'passed', 'passed']);
    });

    it('stops at the first failing persona and leaves implementation running', async () => {
      workspaceRepo.getWorkflowState.mockResolvedValue(gateState());
      workspaceRepo.readFile.mockImplementation((_w: string, p: string) =>
        Promise.resolve(p.includes('security') ? 'blocking issue\n\nVERDICT: FAIL' : 'VERDICT: PASS')
      );
      const order: string[] = [];
      agentRunner.runPersona = vi.fn().mockImplementation(
        (_w: string, _f: string, persona: any) => {
          order.push(persona.id);
          return Promise.resolve(0);
        }
      );

      const state = await service.runImplementationGate(
        '/workspace',
        'auth',
        { agentType: 'claude' },
        DEFAULT_PERSONAS
      );

      // tech-lead must NOT run after security fails
      expect(order).toEqual(['qa', 'code-review', 'security']);
      const impl = state.features[0].phases.find(p => p.phase === 'implementation')!;
      expect(impl.status).toBe('running');
      const byId = Object.fromEntries((impl.personas ?? []).map(p => [p.id, p.status]));
      expect(byId.security).toBe('failed');
      expect(byId['tech-lead']).toBe('idle');
    });

    it('falls back to exit code when no VERDICT marker is present', async () => {
      workspaceRepo.getWorkflowState.mockResolvedValue(gateState());
      workspaceRepo.readFile.mockRejectedValue(new Error('File not found')); // triggers catch block in resolvePersonaVerdict
      // qa exits non-zero -> failed; gate stops
      agentRunner.runPersona = vi.fn().mockResolvedValue(1);

      const state = await service.runImplementationGate(
        '/workspace',
        'auth',
        { agentType: 'claude' },
        [DEFAULT_PERSONAS[0]] // only QA enabled
      );

      const impl = state.features[0].phases.find(p => p.phase === 'implementation')!;
      expect(impl.personas?.find(p => p.id === 'qa')?.status).toBe('failed');
      expect(impl.status).toBe('running');
    });
  });

  it('runs implementation gate from runPhase if personas are provided', async () => {
    const runningState: WorkflowState = JSON.parse(JSON.stringify(mockState));
    const implPhase = runningState.features[0].phases.find(p => p.phase === 'implementation')!;
    implPhase.status = 'idle';
    workspaceRepo.getWorkflowState.mockResolvedValue(runningState);
    workspaceRepo.readFile.mockResolvedValue('VERDICT: PASS');
    agentRunner.runPhase = vi.fn().mockResolvedValue(0);
    agentRunner.runPersona = vi.fn().mockResolvedValue(0);

    const state = await service.runPhase(
      '/workspace',
      'implementation',
      'auth',
      { agentType: 'claude' },
      '',
      undefined,
      [DEFAULT_PERSONAS[0]] // pass personas
    );

    const impl = state.features[0].phases.find(p => p.phase === 'implementation')!;
    expect(impl.status).toBe('awaiting_review');
  });



  it('delegates writeStdin to agentRunner.writeStdin', async () => {
    agentRunner.writeStdin = vi.fn().mockResolvedValue(true);
    const result = await service.writeStdin('specification', 'auth', 'user input', 'qa');
    expect(result).toBe(true);
    expect(agentRunner.writeStdin).toHaveBeenCalledWith('specification', 'auth', 'user input', 'qa');
  });

  it('delegates resize to agentRunner.resize', async () => {
    agentRunner.resize = vi.fn().mockResolvedValue(true);
    const result = await service.resize('specification', 'auth', 80, 24, 'qa');
    expect(result).toBe(true);
    expect(agentRunner.resize).toHaveBeenCalledWith('specification', 'auth', 80, 24, 'qa');
  });

  it('calls writeFile and triggers state update', async () => {
    workspaceRepo.writeFile = vi.fn().mockResolvedValue(undefined);
    workspaceRepo.getWorkflowState = vi.fn().mockResolvedValue(mockState);
    workspaceRepo.saveWorkflowState = vi.fn().mockResolvedValue(undefined);
    const state = await service.writeFile('/workspace', 'file.md', 'content');
    expect(state).toBe(mockState);
    expect(workspaceRepo.writeFile).toHaveBeenCalledWith('/workspace', 'file.md', 'content');
    expect(workspaceRepo.saveWorkflowState).toHaveBeenCalled();
  });

  it('calls stop on agentRunner', async () => {
    agentRunner.stop = vi.fn().mockResolvedValue(true);
    const result = await service.stop('implementation', 'auth', 'qa');
    expect(result).toBe(true);
    expect(agentRunner.stop).toHaveBeenCalledWith('implementation', 'auth', 'qa');
  });

  describe('edge case branches', () => {
    it('discardPhase returns state unchanged if feature is not found', async () => {
      const state = await service.discardPhase('/workspace', 'specification', 'non-existent-feature');
      expect(state.activeFeatureName).toBe('auth');
    });

    it('discardPhase returns state unchanged if phase index is invalid', async () => {
      const state = await service.discardPhase('/workspace', 'invalid-phase' as any, 'auth');
      expect(state.activeFeatureName).toBe('auth');
    });

    it('toggleTask does not auto-review if feature is not found', async () => {
      workspaceRepo.toggleTask.mockResolvedValue(mockState);
      const state = await service.toggleTask('/workspace', 'non-existent-feature', 0, true);
      expect(state).toBe(mockState);
    });

    it('toggleTask does not auto-review if tasksPhase filePath is missing', async () => {
      const tasksMissingState: WorkflowState = JSON.parse(JSON.stringify(mockState));
      const tasksPhase = tasksMissingState.features[0].phases.find(p => p.phase === 'tasks')!;
      tasksPhase.filePath = null;
      workspaceRepo.toggleTask.mockResolvedValue(tasksMissingState);

      const state = await service.toggleTask('/workspace', 'auth', 0, true);
      expect(state).toBe(tasksMissingState);
    });
  });
});


