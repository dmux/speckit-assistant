import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowService } from './WorkflowService';
import { WorkspaceRepositoryPort } from '../ports/out/WorkspaceRepositoryPort';
import { AgentRunnerPort } from '../ports/out/AgentRunnerPort';
import { WorkflowState, FeatureWorkflow } from '../models/types';

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
      runPhase: vi.fn()
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
});
