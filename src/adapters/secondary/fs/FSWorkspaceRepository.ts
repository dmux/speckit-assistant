import { WorkspaceRepositoryPort } from '../../../domain/ports/out/WorkspaceRepositoryPort';
import { WorkflowState, WorkflowPhase, PhaseState, FeatureWorkflow, PhaseStatus } from '../../../domain/models/types';
import * as fs from 'fs';
import * as path from 'path';

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

export class FSWorkspaceRepository implements WorkspaceRepositoryPort {
  async getWorkflowState(workspacePath: string): Promise<WorkflowState> {
    const state = this.loadStateFile(workspacePath) || this.defaultWorkflowState();
    
    // 1. Reconcile Constitution
    const constitutionPath = path.join(workspacePath, '.specify', 'memory', 'constitution.md');
    if (fs.existsSync(constitutionPath)) {
      state.constitutionPhase.filePath = constitutionPath;
      state.constitutionPhase.content = fs.readFileSync(constitutionPath, 'utf-8');
      if (state.constitutionPhase.status === 'idle') {
        state.constitutionPhase.status = 'awaiting_review';
      }
    } else {
      state.constitutionPhase.filePath = null;
      state.constitutionPhase.content = null;
      // Don't clobber explicit user/runtime states when no file is on disk:
      // 'running' (agent still generating) and 'approved' (a stored user decision,
      // e.g. advanced via Kanban drag) must survive reconciliation.
      if (!this.isUserState(state.constitutionPhase.status)) {
        state.constitutionPhase.status = 'idle';
      }
    }

    // 2. Reconcile Features in specs/
    const specsDir = path.join(workspacePath, 'specs');
    if (fs.existsSync(specsDir)) {
      const entries = fs.readdirSync(specsDir, { withFileTypes: true });
      const foundFeatureNames = entries
        .filter(e => e.isDirectory())
        .map(e => e.name);

      // Add newly found features that aren't in state
      for (const name of foundFeatureNames) {
        if (!state.features.some(f => f.name === name)) {
          state.features.push(this.makeFeatureWorkflow(name));
        }
      }

      // Filter out deleted features
      state.features = state.features.filter(f => foundFeatureNames.includes(f.name));

      // Reconcile each feature's files
      for (const feature of state.features) {
        const fileMap: Array<{ file: string; phase: WorkflowPhase }> = [
          { file: 'spec.md', phase: 'specification' },
          { file: 'plan.md', phase: 'planning' },
          { file: 'checklist.md', phase: 'checklist' },
          { file: 'analysis.md', phase: 'analyze' },
          { file: 'tasks.md', phase: 'tasks' }
        ];

        for (const { file, phase } of fileMap) {
          const fp = path.join(specsDir, feature.name, file);
          const ps = feature.phases.find(p => p.phase === phase)!;
          if (fs.existsSync(fp)) {
            ps.filePath = fp;
            ps.content = fs.readFileSync(fp, 'utf-8');
            if (ps.status === 'idle') {
              ps.status = 'awaiting_review';
            }
          } else {
            ps.filePath = null;
            ps.content = null;
            if (!this.isUserState(ps.status)) {
              ps.status = 'idle';
            }
          }
        }

        // Reconcile clarification (clarification.md or clarify.md)
        const clarifyPhase = feature.phases.find(p => p.phase === 'clarification')!;
        const clarifyPath1 = path.join(specsDir, feature.name, 'clarification.md');
        const clarifyPath2 = path.join(specsDir, feature.name, 'clarify.md');
        const finalClarifyPath = fs.existsSync(clarifyPath1) ? clarifyPath1 : (fs.existsSync(clarifyPath2) ? clarifyPath2 : null);

        if (finalClarifyPath) {
          clarifyPhase.filePath = finalClarifyPath;
          clarifyPhase.content = fs.readFileSync(finalClarifyPath, 'utf-8');
          if (clarifyPhase.status === 'idle') {
            clarifyPhase.status = 'awaiting_review';
          }
        } else {
          clarifyPhase.filePath = null;
          clarifyPhase.content = null;
          if (!this.isUserState(clarifyPhase.status)) {
            clarifyPhase.status = 'idle';
          }
        }

        // Implementation phase doesn't have its own file, but we can resolve its status.
        // If specs/[feature]/tasks.md exists, and all checkboxes are checked, it could be complete.
        // It relies on tasks status or manual review.
        const implPhase = feature.phases.find(p => p.phase === 'implementation')!;
        // Make sure its filePath is null (since there is no implementation.md file)
        implPhase.filePath = null;
        implPhase.content = null;

        // Reconcile review-gate personas against their report files. Statuses
        // saved by the gate are kept; this is a safety net that also reflects a
        // report written/edited out of band. Never downgrade a 'running' persona.
        if (implPhase.personas) {
          for (const persona of implPhase.personas) {
            const reportFp = path.join(specsDir, feature.name, 'reviews', `${persona.id}.md`);
            if (fs.existsSync(reportFp)) {
              persona.reportPath = path.join('specs', feature.name, 'reviews', `${persona.id}.md`);
              if (persona.status !== 'running') {
                const verdict = fs.readFileSync(reportFp, 'utf-8').toUpperCase();
                if (/VERDICT:\s*FAIL/.test(verdict)) persona.status = 'failed';
                else if (/VERDICT:\s*PASS/.test(verdict)) persona.status = 'passed';
              }
            }
          }
        }
      }
    } else {
      state.features = [];
    }

    if (!state.activeFeatureName && state.features.length > 0) {
      state.activeFeatureName = state.features[0].name;
    }

    return state;
  }

  async saveWorkflowState(workspacePath: string, state: WorkflowState): Promise<void> {
    const runtimeDir = path.join(workspacePath, '.specify', '.runtime');
    if (!fs.existsSync(runtimeDir)) {
      fs.mkdirSync(runtimeDir, { recursive: true });
    }
    const statePath = path.join(runtimeDir, 'workflow-state.json');
    
    // We only save metadata (statuses and stale flag) to file to avoid writing bloated contents.
    // Content is read dynamically from disk during reconciliation anyway.
    const minimalState = {
      constitutionPhase: {
        phase: state.constitutionPhase.phase,
        status: state.constitutionPhase.status,
        stale: state.constitutionPhase.stale
      },
      features: state.features.map(f => ({
        name: f.name,
        phases: f.phases.map(p => ({
          phase: p.phase,
          status: p.status,
          stale: p.stale,
          // Persist the implementation review-gate persona statuses.
          ...(p.personas ? { personas: p.personas.map(ps => ({ id: ps.id, status: ps.status })) } : {})
        }))
      })),
      activeFeatureName: state.activeFeatureName
    };

    fs.writeFileSync(statePath, JSON.stringify(minimalState, null, 2), 'utf-8');
  }

  async toggleTask(workspacePath: string, featureName: string, lineIndex: number, checked: boolean): Promise<WorkflowState> {
    const tasksPath = path.join(workspacePath, 'specs', featureName, 'tasks.md');
    if (!fs.existsSync(tasksPath)) {
      throw new Error(`Tasks file not found at ${tasksPath}`);
    }

    const content = fs.readFileSync(tasksPath, 'utf-8');
    const lines = content.split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) {
      throw new Error(`Line index ${lineIndex} out of range`);
    }

    lines[lineIndex] = lines[lineIndex].replace(
      /^(\s*(?:[-*]|\d+\.)\s+\[)( |x|X)(\])/,
      (_, pre, _c, post) => `${pre}${checked ? 'x' : ' '}${post}`
    );

    fs.writeFileSync(tasksPath, lines.join('\n'), 'utf-8');

    // Return the updated state
    return this.getWorkflowState(workspacePath);
  }

  async createFeature(workspacePath: string, name: string): Promise<WorkflowState> {
    const specsDir = path.join(workspacePath, 'specs');
    const featureDir = path.join(specsDir, name);
    
    if (!fs.existsSync(featureDir)) {
      fs.mkdirSync(featureDir, { recursive: true });
    }

    // Try to run specify specify command or let the user do it via UI.
    // We just create the directory. The files will be generated when the agent runs.
    return this.getWorkflowState(workspacePath);
  }

  async deleteFeature(workspacePath: string, name: string): Promise<WorkflowState> {
    const featureDir = path.join(workspacePath, 'specs', name);
    if (fs.existsSync(featureDir)) {
      fs.rmSync(featureDir, { recursive: true, force: true });
    }

    const state = await this.getWorkflowState(workspacePath);
    if (state.activeFeatureName === name) {
      state.activeFeatureName = state.features.length > 0 ? state.features[0].name : null;
    }
    await this.saveWorkflowState(workspacePath, state);
    return state;
  }

  async readFile(workspacePath: string, filePath: string): Promise<string> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(workspacePath, filePath);
    
    if (!this.isPathSafe(workspacePath, absolutePath)) {
      throw new Error('Access denied: Path is outside the workspace directory.');
    }

    if (!fs.existsSync(absolutePath)) {
      return '';
    }
    return fs.readFileSync(absolutePath, 'utf-8');
  }

  async writeFile(workspacePath: string, filePath: string, content: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(workspacePath, filePath);
    
    if (!this.isPathSafe(workspacePath, absolutePath)) {
      throw new Error('Access denied: Path is outside the workspace directory.');
    }

    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(absolutePath, content, 'utf-8');
  }

  private isPathSafe(workspacePath: string, absolutePath: string): boolean {
    const normWorkspace = path.normalize(workspacePath).replace(/\\/g, '/').toLowerCase();
    const normAbsolute = path.normalize(absolutePath).replace(/\\/g, '/').toLowerCase();
    
    if (normAbsolute === normWorkspace) return true;
    return normAbsolute.startsWith(normWorkspace.endsWith('/') ? normWorkspace : normWorkspace + '/');
  }

  // State initialization helpers
  private defaultWorkflowState(): WorkflowState {
    return {
      constitutionPhase: { phase: 'constitution', status: 'idle', filePath: null, content: null },
      features: [],
      activeFeatureName: null
    };
  }

  private makePhaseState(phase: WorkflowPhase): PhaseState {
    return { phase, status: 'idle', filePath: null, content: null };
  }

  private makeFeatureWorkflow(name: string): FeatureWorkflow {
    return {
      name,
      phases: FEATURE_PHASES.map(p => this.makePhaseState(p))
    };
  }

  private isUserState(status: PhaseStatus): boolean {
    return status === 'running' || status === 'approved';
  }

  private loadStateFile(workspacePath: string): WorkflowState | null {
    const statePath = path.join(workspacePath, '.specify', '.runtime', 'workflow-state.json');
    if (!fs.existsSync(statePath)) {
      return null;
    }
    try {
      const payload = fs.readFileSync(statePath, 'utf-8');
      const data = JSON.parse(payload);
      
      // Merge with default formats
      const state = this.defaultWorkflowState();
      state.constitutionPhase.status = data.constitutionPhase?.status || 'idle';
      state.constitutionPhase.stale = data.constitutionPhase?.stale || false;
      
      if (Array.isArray(data.features)) {
        state.features = data.features.map((f: any) => ({
          name: f.name,
          phases: FEATURE_PHASES.map(p => {
            const savedPhase = f.phases?.find((sp: any) => sp.phase === p);
            return {
              phase: p,
              status: savedPhase?.status || 'idle',
              stale: savedPhase?.stale || false,
              filePath: null,
              content: null,
              ...(Array.isArray(savedPhase?.personas)
                ? { personas: savedPhase.personas.map((ps: any) => ({ id: ps.id, status: ps.status || 'idle' })) }
                : {})
            };
          })
        }));
      }
      state.activeFeatureName = data.activeFeatureName || null;
      return state;
    } catch {
      return null;
    }
  }
}
