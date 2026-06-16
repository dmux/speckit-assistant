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
    expect(state.features.length).toBe(2);
    
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
});
