import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { workflowService } from '@/adapters/di';
import { GET as getState, POST as postState } from './state/route';
import { GET as watchState } from './state/watch/route';
import { POST as createFeature, DELETE as deleteFeature } from './feature/route';
import { POST as toggleTask } from './task/route';
import { GET as readFile, POST as writeFile } from './file/route';
import { POST as managePhase } from './phase/route';
import * as fs from 'fs';
import * as path from 'path';

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

describe('Next.js API Routes - E2E Integration Tests', () => {
  const demoPath = path.resolve(__dirname, '../../../../speckit-demo');
  const tempPath = path.resolve(__dirname, 'tmp-api-test-workspace');

  beforeAll(() => {
    // Copy demoPath to tempPath once for the entire suite
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { recursive: true, force: true });
    }
    copyDirSync(demoPath, tempPath);
    process.env.WORKSPACE_PATH = tempPath;
  });

  beforeEach(() => {
    // Clean up state and specs that might have been changed in previous tests, without recreating directory
    const statePath = path.join(tempPath, '.specify', '.runtime', 'workflow-state.json');
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }

    const extraFeaturePath = path.join(tempPath, 'specs', '003-billing');
    if (fs.existsSync(extraFeaturePath)) {
      fs.rmSync(extraFeaturePath, { recursive: true, force: true });
    }

    // Reset task checkboxes back to original
    const specFilePath = path.join(tempPath, 'specs', '001-user-authentication', 'spec.md');
    if (fs.existsSync(specFilePath)) {
      fs.writeFileSync(specFilePath, '# Specification: User Authentication\n\n## Goal\nBuild a simple email-and-password authentication system.');
    }
  });

  afterEach(() => {
    const extraFeaturePath = path.join(tempPath, 'specs', '003-billing');
    if (fs.existsSync(extraFeaturePath)) {
      fs.rmSync(extraFeaturePath, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // Remove temp path at the end of all tests
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { recursive: true, force: true });
    }
  });

  it('should get and update the workflow state', async () => {
    // 1. GET state
    const getReq = new Request('http://localhost/api/state');
    const getRes = await getState();
    const state = await getRes.json();
    
    expect(state.constitutionPhase.status).toBe('awaiting_review');
    expect(state.features.length).toBe(3);

    // 2. POST update active feature
    const postReq = new Request('http://localhost/api/state', {
      method: 'POST',
      body: JSON.stringify({ activeFeatureName: '001-user-authentication' })
    });
    const postRes = await postState(postReq);
    const updatedState = await postRes.json();
    expect(updatedState.activeFeatureName).toBe('001-user-authentication');
  });

  it('should create and delete features', async () => {
    // 1. Create feature
    const createReq = new Request('http://localhost/api/feature', {
      method: 'POST',
      body: JSON.stringify({ name: '003-billing' })
    });
    const createRes = await createFeature(createReq);
    const stateAfterCreate = await createRes.json();
    
    expect(stateAfterCreate.features.some((f: any) => f.name === '003-billing')).toBe(true);
    expect(fs.existsSync(path.join(tempPath, 'specs', '003-billing'))).toBe(true);

    // 2. Delete feature
    const deleteReq = new Request('http://localhost/api/feature', {
      method: 'DELETE',
      body: JSON.stringify({ name: '003-billing' })
    });
    const deleteRes = await deleteFeature(deleteReq);
    const stateAfterDelete = await deleteRes.json();
    
    expect(stateAfterDelete.features.some((f: any) => f.name === '003-billing')).toBe(false);
    expect(fs.existsSync(path.join(tempPath, 'specs', '003-billing'))).toBe(false);
  });

  it('should read and write spec files', async () => {
    const filePath = 'specs/001-user-authentication/spec.md';
    
    // 1. Read file
    const readReq = new Request(`http://localhost/api/file?path=${encodeURIComponent(filePath)}`);
    const readRes = await readFile(readReq);
    const fileData = await readRes.json();
    expect(fileData.content).toContain('Specification: User Authentication');

    // 2. Write file
    const newContent = 'Updated Spec Content';
    const writeReq = new Request('http://localhost/api/file', {
      method: 'POST',
      body: JSON.stringify({ path: filePath, content: newContent })
    });
    const writeRes = await writeFile(writeReq);
    const writeResult = await writeRes.json();
    expect(writeResult.success).toBe(true);

    // Confirm written
    const confirmRes = await readFile(readReq);
    const confirmData = await confirmRes.json();
    expect(confirmData.content).toBe(newContent);

    // Reset file content
    const resetReq = new Request('http://localhost/api/file', {
      method: 'POST',
      body: JSON.stringify({ path: filePath, content: '# Specification: User Authentication\n\n## Goal\nBuild a simple email-and-password authentication system.' })
    });
    await writeFile(resetReq);
  });

  it('should toggle tasks and update completion status', async () => {
    // 1. Check a task
    const toggleReq1 = new Request('http://localhost/api/task', {
      method: 'POST',
      body: JSON.stringify({
        featureName: '001-user-authentication',
        lineIndex: 4, // "Implement login route and JWT sign"
        checked: true
      })
    });
    const res1 = await toggleTask(toggleReq1);
    const state1 = await res1.json();
    
    const tasksPhase = state1.features
      .find((f: any) => f.name === '001-user-authentication')
      .phases.find((p: any) => p.phase === 'tasks');
      
    expect(tasksPhase.content).toContain('- [x] Implement login route and JWT sign');

    // Reset it back
    const toggleReq2 = new Request('http://localhost/api/task', {
      method: 'POST',
      body: JSON.stringify({
        featureName: '001-user-authentication',
        lineIndex: 4,
        checked: false
      })
    });
    await toggleTask(toggleReq2);
  });

  it('should approve and discard phases', async () => {
    // 1. Approve Specification phase
    const approveReq = new Request('http://localhost/api/phase', {
      method: 'POST',
      body: JSON.stringify({
        action: 'approve',
        phase: 'specification',
        featureName: '001-user-authentication'
      })
    });
    const approveRes = await managePhase(approveReq);
    const approvedState = await approveRes.json();
    
    const specPhaseApproved = approvedState.features
      .find((f: any) => f.name === '001-user-authentication')
      .phases.find((p: any) => p.phase === 'specification');
      
    expect(specPhaseApproved.status).toBe('approved');

    // 2. Discard Specification phase (downstream becomes stale)
    const discardReq = new Request('http://localhost/api/phase', {
      method: 'POST',
      body: JSON.stringify({
        action: 'discard',
        phase: 'specification',
        featureName: '001-user-authentication'
      })
    });
    const discardRes = await managePhase(discardReq);
    const discardedState = await discardRes.json();

    const specPhaseDiscarded = discardedState.features
      .find((f: any) => f.name === '001-user-authentication')
      .phases.find((p: any) => p.phase === 'specification');
      
    expect(specPhaseDiscarded.status).toBe('idle');
  });

  it('should run a phase and output streaming SSE logs', async () => {
    const runReq = new Request('http://localhost/api/phase', {
      method: 'POST',
      body: JSON.stringify({
        action: 'run',
        phase: 'specification',
        featureName: '001-user-authentication',
        agentConfig: {
          agentType: 'custom',
          customCommand: 'echo "mock execution output"'
        }
      })
    });

    const runRes = await managePhase(runReq);
    expect(runRes.headers.get('Content-Type')).toBe('text/event-stream');
    
    const reader = runRes.body?.getReader();
    expect(reader).toBeDefined();
    
    const decoder = new TextDecoder();
    let logsAccumulated = '';
    
    while (true) {
      const { value, done } = await reader!.read();
      if (done) break;
      logsAccumulated += decoder.decode(value);
    }
    
    expect(logsAccumulated).toContain('mock execution output');
    expect(logsAccumulated).toContain('event: done');
  });

  it('should stream updates when files change via watch route', async () => {
    const watchRes = await watchState();
    expect(watchRes.headers.get('Content-Type')).toBe('text/event-stream');

    const reader = watchRes.body?.getReader();
    expect(reader).toBeDefined();

    const decoderText = new TextDecoder();

    // Write a dummy change to a specification file in the demo workspace
    const dummyFilePath = path.join(tempPath, 'specs', '001-user-authentication', 'spec.md');
    const originalContent = fs.readFileSync(dummyFilePath, 'utf8');

    // Start reading the stream
    const readPromise = (async () => {
      let buffer = '';
      while (true) {
        const { value, done } = await reader!.read();
        if (done) break;
        buffer += decoderText.decode(value);
        if (buffer.includes('event: update')) {
          return buffer;
        }
      }
      return buffer;
    })();

    // Perform the write to trigger chokidar
    fs.writeFileSync(dummyFilePath, originalContent + '\n\n<!-- dummy change -->');

    try {
      // Wait for the stream update with a timeout
      const result = await Promise.race([
        readPromise,
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for watch update')), 4000))
      ]);

      expect(result).toContain('event: update');
      expect(result).toContain('changedFile');
      expect(result).toContain('specs/001-user-authentication/spec.md');
    } finally {
      // Clean up/cancel reader and restore file
      await reader!.cancel();
      try {
        await watchRes.body?.cancel();
      } catch {
        // ignore
      }
      fs.writeFileSync(dummyFilePath, originalContent);
    }
  });

  it('should handle missing parameters across routes', async () => {
    // 1. Feature route missing name
    const res1 = await createFeature(new Request('http://localhost/api/feature', { method: 'POST', body: JSON.stringify({}) }));
    expect(res1.status).toBe(400);
    const err1 = await res1.json();
    expect(err1.error).toBe('Feature name is required');

    const res1Delete = await deleteFeature(new Request('http://localhost/api/feature', { method: 'DELETE', body: JSON.stringify({}) }));
    expect(res1Delete.status).toBe(400);

    // 2. File route missing path
    const res2 = await readFile(new Request('http://localhost/api/file'));
    expect(res2.status).toBe(400);

    const res2Write = await writeFile(new Request('http://localhost/api/file', { method: 'POST', body: JSON.stringify({}) }));
    expect(res2Write.status).toBe(400);

    // 3. Task route missing parameters
    const res3 = await toggleTask(new Request('http://localhost/api/task', { method: 'POST', body: JSON.stringify({}) }));
    expect(res3.status).toBe(400);

    // 4. Phase route missing action
    const res4 = await managePhase(new Request('http://localhost/api/phase', { method: 'POST', body: JSON.stringify({}) }));
    expect(res4.status).toBe(400);
    
    // Invalid action on phase
    const res5 = await managePhase(new Request('http://localhost/api/phase', {
      method: 'POST',
      body: JSON.stringify({ action: 'invalid', phase: 'specification' })
    }));
    expect(res5.status).toBe(400);
  });

  it('should handle repository or service errors and return 500 status', async () => {
    const errorMsg = 'Mock database error';
    
    // Save original implementations
    const originals = {
      getWorkflowState: workflowService.getWorkflowState,
      setActiveFeature: workflowService.setActiveFeature,
      createFeature: workflowService.createFeature,
      deleteFeature: workflowService.deleteFeature,
      toggleTask: workflowService.toggleTask,
      readFile: workflowService.readFile,
      writeFile: workflowService.writeFile,
      approvePhase: workflowService.approvePhase,
      runPhase: workflowService.runPhase
    };

    // Override with throwing mocks
    workflowService.getWorkflowState = vi.fn().mockRejectedValue(new Error(errorMsg));
    workflowService.setActiveFeature = vi.fn().mockRejectedValue(new Error(errorMsg));
    workflowService.createFeature = vi.fn().mockRejectedValue(new Error(errorMsg));
    workflowService.deleteFeature = vi.fn().mockRejectedValue(new Error(errorMsg));
    workflowService.toggleTask = vi.fn().mockRejectedValue(new Error(errorMsg));
    workflowService.readFile = vi.fn().mockRejectedValue(new Error(errorMsg));
    workflowService.writeFile = vi.fn().mockRejectedValue(new Error(errorMsg));
    workflowService.approvePhase = vi.fn().mockRejectedValue(new Error(errorMsg));
    workflowService.runPhase = vi.fn().mockRejectedValue(new Error(errorMsg));

    try {
      const res1 = await getState();
      expect(res1.status).toBe(500);
      
      const res2 = await postState(new Request('http://localhost/api/state', { method: 'POST', body: JSON.stringify({ activeFeatureName: 'feat' }) }));
      expect(res2.status).toBe(500);

      const res3 = await createFeature(new Request('http://localhost/api/feature', { method: 'POST', body: JSON.stringify({ name: 'feat' }) }));
      expect(res3.status).toBe(500);

      const res4 = await deleteFeature(new Request('http://localhost/api/feature', { method: 'DELETE', body: JSON.stringify({ name: 'feat' }) }));
      expect(res4.status).toBe(500);

      const res5 = await toggleTask(new Request('http://localhost/api/task', { method: 'POST', body: JSON.stringify({ featureName: 'feat', lineIndex: 0, checked: true }) }));
      expect(res5.status).toBe(500);

      const res6 = await readFile(new Request('http://localhost/api/file?path=specs/feat/spec.md'));
      expect(res6.status).toBe(500);

      const res7 = await writeFile(new Request('http://localhost/api/file', { method: 'POST', body: JSON.stringify({ path: 'specs/feat/spec.md', content: '' }) }));
      expect(res7.status).toBe(500);

      const res8 = await managePhase(new Request('http://localhost/api/phase', { method: 'POST', body: JSON.stringify({ action: 'approve', phase: 'specification', featureName: 'feat' }) }));
      expect(res8.status).toBe(500);

      // Verify runPhase streaming error
      const res9 = await managePhase(new Request('http://localhost/api/phase', { method: 'POST', body: JSON.stringify({ action: 'run', phase: 'specification', featureName: 'feat' }) }));
      expect(res9.status).toBe(200);
      const reader = res9.body?.getReader();
      const decoder = new TextDecoder();
      let logs = '';
      while (true) {
        const { value, done } = await reader!.read();
        if (done) break;
        logs += decoder.decode(value);
      }
      expect(logs).toContain('event: error');
      expect(logs).toContain(errorMsg);
    } finally {
      // Restore original implementations
      Object.assign(workflowService, originals);
    }
  });
});
