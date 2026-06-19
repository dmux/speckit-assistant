import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { FSWorkspaceRepository } from './FSWorkspaceRepository';
import * as path from 'path';
import * as fs from 'fs';

function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

describe('FSWorkspaceRepository - Demo Integration Test', () => {
  const demoPath = path.resolve(__dirname, '../../../../../speckit-demo');
  const tempPath = path.resolve(__dirname, 'tmp-test-workspace');

  beforeEach(() => {
    // Clean and recreate temp workspace
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { recursive: true, force: true });
    }
    copyDirSync(demoPath, tempPath);

    const statePath = path.join(tempPath, '.specify', '.runtime', 'workflow-state.json');
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { recursive: true, force: true });
    }
  });

  it('should successfully scan the spec-kit demo folder and populate state', async () => {
    const repo = new FSWorkspaceRepository();

    const state = await repo.getWorkflowState(tempPath);

    // 1. Assert Constitution loaded
    expect(state.constitutionPhase.status).toBe('awaiting_review');
    expect(state.constitutionPhase.filePath).toContain('.specify/memory/constitution.md');
    expect(state.constitutionPhase.content).toContain('Project Constitution - Speckit Demo');

    // 2. Assert Features
    expect(state.features.length).toBe(3);
    
    // Sort features by name for consistent testing
    const features = [...state.features].sort((a, b) => a.name.localeCompare(b.name));
    
    const authFeat = features[0];
    const cartFeat = features[1];

    expect(authFeat.name).toBe('001-user-authentication');
    expect(cartFeat.name).toBe('002-shopping-cart');

    // Auth feature phases
    const authSpec = authFeat.phases.find(p => p.phase === 'specification')!;
    const authPlan = authFeat.phases.find(p => p.phase === 'planning')!;
    const authTasks = authFeat.phases.find(p => p.phase === 'tasks')!;
    const authImpl = authFeat.phases.find(p => p.phase === 'implementation')!;

    expect(authSpec.status).toBe('awaiting_review');
    expect(authSpec.content).toContain('Specification: User Authentication');

    expect(authPlan.status).toBe('awaiting_review');
    expect(authPlan.content).toContain('Technical Plan: User Authentication');

    expect(authTasks.status).toBe('awaiting_review');
    expect(authTasks.content).toContain('- [x] Set up SQLite database schema');

    expect(authImpl.status).toBe('idle');
    expect(authImpl.filePath).toBeNull();

    // Cart feature phases (only spec exists)
    const cartSpec = cartFeat.phases.find(p => p.phase === 'specification')!;
    const cartPlan = cartFeat.phases.find(p => p.phase === 'planning')!;

    expect(cartSpec.status).toBe('awaiting_review');
    expect(cartSpec.content).toContain('Specification: Shopping Cart');

    expect(cartPlan.status).toBe('idle');
    expect(cartPlan.filePath).toBeNull();
  });

  it('should validate and normalize paths safely to prevent directory traversal on all platforms', async () => {
    const repo = new FSWorkspaceRepository();

    // 1. Valid paths inside workspace
    const validRelative = 'specs/001-user-authentication/spec.md';
    const validAbsolute = path.join(tempPath, 'specs/001-user-authentication/spec.md');
    
    const content1 = await repo.readFile(tempPath, validRelative);
    expect(content1).toBeDefined();

    const content2 = await repo.readFile(tempPath, validAbsolute);
    expect(content2).toBeDefined();

    // 2. Traversal path (outside workspace)
    const invalidPath = path.join(tempPath, '../../package.json');
    await expect(repo.readFile(tempPath, invalidPath)).rejects.toThrow('Access denied');
    await expect(repo.writeFile(tempPath, invalidPath, '{}')).rejects.toThrow('Access denied');

    // 3. Similar name containment check (e.g. /workspace-other vs /workspace)
    const relativeSibling = process.platform === 'win32' 
      ? '..\\speckit-demo-other\\spec.md' 
      : '../speckit-demo-other/spec.md';
      
    await expect(repo.readFile(tempPath, relativeSibling)).rejects.toThrow('Access denied');
  });

  it('persists implementation review-gate personas and reconciles verdicts from report files', async () => {
    const repo = new FSWorkspaceRepository();
    const feature = '001-user-authentication';

    // Seed persona state on the implementation phase and save it.
    const state = await repo.getWorkflowState(tempPath);
    const feat = state.features.find(f => f.name === feature)!;
    const impl = feat.phases.find(p => p.phase === 'implementation')!;
    impl.personas = [
      { id: 'qa', status: 'passed' },
      { id: 'security', status: 'running' },
    ];
    await repo.saveWorkflowState(tempPath, state);

    // Round-trip: personas survive reload.
    const reloaded = await repo.getWorkflowState(tempPath);
    const implReloaded = reloaded.features.find(f => f.name === feature)!
      .phases.find(p => p.phase === 'implementation')!;
    const byId = Object.fromEntries((implReloaded.personas ?? []).map(p => [p.id, p.status]));
    expect(byId.qa).toBe('passed');
    // 'running' is preserved (no report on disk yet).
    expect(byId.security).toBe('running');

    // Write a QA report with a FAIL verdict; reconciliation should flip qa -> failed.
    const reviewsDir = path.join(tempPath, 'specs', feature, 'reviews');
    fs.mkdirSync(reviewsDir, { recursive: true });
    fs.writeFileSync(path.join(reviewsDir, 'qa.md'), 'found a defect\n\nVERDICT: FAIL', 'utf-8');

    const afterReport = await repo.getWorkflowState(tempPath);
    const implAfter = afterReport.features.find(f => f.name === feature)!
      .phases.find(p => p.phase === 'implementation')!;
    expect(implAfter.personas?.find(p => p.id === 'qa')?.status).toBe('failed');
  });

  it('reconciles a checklist/ directory into multiple phase files (sorted, first as primary)', async () => {
    const repo = new FSWorkspaceRepository();
    const feature = '002-shopping-cart';
    const checklistDir = path.join(tempPath, 'specs', feature, 'checklist');
    fs.mkdirSync(checklistDir, { recursive: true });
    // Write out of alphabetical order to verify sorting.
    fs.writeFileSync(path.join(checklistDir, 'ux.md'), '# UX Checklist\n- [ ] a', 'utf-8');
    fs.writeFileSync(path.join(checklistDir, 'api.md'), '# API Checklist\n- [ ] b', 'utf-8');

    const state = await repo.getWorkflowState(tempPath);
    const feat = state.features.find(f => f.name === feature)!;
    const checklist = feat.phases.find(p => p.phase === 'checklist')!;

    expect(checklist.status).toBe('awaiting_review');
    expect(checklist.files?.map(f => path.basename(f.path))).toEqual(['api.md', 'ux.md']);
    // filePath/content point at the first (sorted) file.
    expect(path.basename(checklist.filePath!)).toBe('api.md');
    expect(checklist.content).toContain('API Checklist');
  });

  it('reconciles a single checklist.md file without populating files', async () => {
    const repo = new FSWorkspaceRepository();
    const feature = '002-shopping-cart';
    fs.writeFileSync(
      path.join(tempPath, 'specs', feature, 'checklist.md'),
      '# Checklist\n- [ ] one',
      'utf-8'
    );

    const state = await repo.getWorkflowState(tempPath);
    const checklist = state.features.find(f => f.name === feature)!
      .phases.find(p => p.phase === 'checklist')!;

    expect(checklist.status).toBe('awaiting_review');
    expect(checklist.files).toBeUndefined();
    expect(path.basename(checklist.filePath!)).toBe('checklist.md');
    expect(checklist.content).toContain('Checklist');
  });

  it('leaves the checklist phase idle when neither checklist.md nor checklist/ exists', async () => {
    const repo = new FSWorkspaceRepository();
    const feature = '002-shopping-cart';

    const state = await repo.getWorkflowState(tempPath);
    const checklist = state.features.find(f => f.name === feature)!
      .phases.find(p => p.phase === 'checklist')!;

    expect(checklist.status).toBe('idle');
    expect(checklist.filePath).toBeNull();
    expect(checklist.files).toBeUndefined();
  });

  it('persists and reloads captured cost metadata on phases and personas', async () => {
    const repo = new FSWorkspaceRepository();
    const feature = '001-user-authentication';

    const state = await repo.getWorkflowState(tempPath);
    const feat = state.features.find(f => f.name === feature)!;
    const spec = feat.phases.find(p => p.phase === 'specification')!;
    spec.cost = { totalTokens: 420, costUSD: 0.012, durationMs: 3000, source: 'estimated' };
    const impl = feat.phases.find(p => p.phase === 'implementation')!;
    impl.personas = [{ id: 'qa', status: 'passed', cost: { totalTokens: 100, costUSD: 0.004, durationMs: 900, source: 'parsed' } }];
    await repo.saveWorkflowState(tempPath, state);

    const reloaded = await repo.getWorkflowState(tempPath);
    const reFeat = reloaded.features.find(f => f.name === feature)!;
    expect(reFeat.phases.find(p => p.phase === 'specification')!.cost).toEqual(spec.cost);
    const reImpl = reFeat.phases.find(p => p.phase === 'implementation')!;
    expect(reImpl.personas?.find(p => p.id === 'qa')?.cost).toEqual(impl.personas![0].cost);
  });

  it('preserves approved phase statuses during reconciliation even if phase file is missing', async () => {
    const repo = new FSWorkspaceRepository();
    const feature = '002-shopping-cart';

    // 1. Initially planning is idle because plan.md does not exist
    let state = await repo.getWorkflowState(tempPath);
    let feat = state.features.find(f => f.name === feature)!;
    let plan = feat.phases.find(p => p.phase === 'planning')!;
    expect(plan.status).toBe('idle');

    // 2. Set planning status to approved and save
    plan.status = 'approved';
    await repo.saveWorkflowState(tempPath, state);

    // 3. Re-scan: the approved status must survive even though plan.md is missing on disk
    const reloaded = await repo.getWorkflowState(tempPath);
    const reloadedFeat = reloaded.features.find(f => f.name === feature)!;
    const reloadedPlan = reloadedFeat.phases.find(p => p.phase === 'planning')!;
    expect(reloadedPlan.status).toBe('approved');
  });
});

