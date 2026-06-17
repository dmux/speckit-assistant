import { describe, it, expect, beforeEach } from 'vitest';
import { loadPty, _clearPtyCacheForTesting } from './ptyLoader';

describe('ptyLoader', () => {
  beforeEach(() => {
    _clearPtyCacheForTesting();
    delete process.env.SPECKIT_TEST_FORCE_FALLBACK;
  });

  it('loads node-pty if available', () => {
    const pty = loadPty();
    expect(pty).toBeDefined();
    expect(pty.spawn).toBeDefined();
  });

  it('falls back to pure child_process pty emulation if node-pty loading fails/is forced', () => {
    process.env.SPECKIT_TEST_FORCE_FALLBACK = 'true';
    const pty = loadPty();
    expect(pty).toBeDefined();
    
    const spawned = pty.spawn('echo', ['hello'], { cwd: process.cwd() });
    expect(spawned.write).toBeDefined();
    expect(spawned.kill).toBeDefined();
    expect(spawned.onData).toBeDefined();
    expect(spawned.onExit).toBeDefined();
    
    spawned.kill();
  });
});
