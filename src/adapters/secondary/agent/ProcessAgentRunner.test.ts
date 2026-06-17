import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessAgentRunner } from './ProcessAgentRunner';
import { loadPty } from '../pty/ptyLoader';

vi.mock('../pty/ptyLoader', () => {
  const mockPtyInstance = {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn(),
    onExit: vi.fn().mockImplementation((cb) => {
      mockPtyInstance._exitCallback = cb;
    }),
    _exitCallback: null as any
  };

  return {
    loadPty: vi.fn().mockReturnValue({
      spawn: vi.fn().mockReturnValue(mockPtyInstance)
    })
  };
});

describe('ProcessAgentRunner', () => {
  let runner: ProcessAgentRunner;
  let mockPty: any;

  beforeEach(() => {
    vi.clearAllMocks();
    runner = new ProcessAgentRunner();
    mockPty = loadPty().spawn('dummy', []);
  });

  it('should run a phase by spawning a process', async () => {
    const runPromise = runner.runPhase(
      '/mock/workspace',
      'specification',
      'feature-1',
      { agentType: 'claude' },
      'user prompt'
    );

    expect(loadPty().spawn).toHaveBeenCalled();

    mockPty._exitCallback({ exitCode: 0 });

    const exitCode = await runPromise;
    expect(exitCode).toBe(0);
  });

  it('should kill the running process when stop is called', async () => {
    const runPromise = runner.runPhase(
      '/mock/workspace',
      'specification',
      'feature-1',
      { agentType: 'claude' },
      'user prompt'
    );

    const stopped = await runner.stop('specification', 'feature-1');
    expect(stopped).toBe(true);
    expect(mockPty.kill).toHaveBeenCalled();

    mockPty._exitCallback({ exitCode: 137 });
    await runPromise;
  });

  it('should return false if stop is called for a process that is not running', async () => {
    const stopped = await runner.stop('specification', 'non-existent-feature');
    expect(stopped).toBe(false);
  });
});
