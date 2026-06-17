import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as terminalInput } from './input/route';
import { POST as terminalResize } from './resize/route';
import { GET as terminalStream } from './stream/route';
import { POST as managePhase } from '../phase/route';
import { GET as watchState } from '../state/watch/route';
import { workflowService } from '@/adapters/di';
import { terminalManager } from '@/adapters/primary/api/terminalManager';

vi.mock('@/adapters/primary/api/terminalManager', () => {
  return {
    terminalManager: {
      writeInput: vi.fn(),
      resize: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }
  };
});

let chokidarCallback: any = null;
vi.mock('chokidar', () => {
  return {
    watch: vi.fn().mockReturnValue({
      on: vi.fn().mockImplementation((event, cb) => {
        chokidarCallback = cb;
      }),
      close: vi.fn(),
    })
  };
});

describe('Terminal & Advanced Phase API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/terminal/input', () => {
    it('returns success: true when text is supplied', async () => {
      vi.mocked(terminalManager.writeInput).mockReturnValue(true);
      const req = new Request('http://localhost/api/terminal/input', {
        method: 'POST',
        body: JSON.stringify({ text: 'ls -la\n' }),
      });
      const res = await terminalInput(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
      expect(terminalManager.writeInput).toHaveBeenCalledWith('ls -la\n');
    });

    it('returns 400 when text is missing', async () => {
      const req = new Request('http://localhost/api/terminal/input', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await terminalInput(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Missing text input');
    });

    it('returns 500 when json parsing fails or an error is thrown', async () => {
      const req = new Request('http://localhost/api/terminal/input', {
        method: 'POST',
        body: 'invalid-json',
      });
      const res = await terminalInput(req);
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/terminal/resize', () => {
    it('returns success: true when cols and rows are valid numbers', async () => {
      vi.mocked(terminalManager.resize).mockReturnValue(true);
      const req = new Request('http://localhost/api/terminal/resize', {
        method: 'POST',
        body: JSON.stringify({ cols: 100, rows: 30 }),
      });
      const res = await terminalResize(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
      expect(terminalManager.resize).toHaveBeenCalledWith(100, 30);
    });

    it('returns 400 when cols or rows are not numbers', async () => {
      const req = new Request('http://localhost/api/terminal/resize', {
        method: 'POST',
        body: JSON.stringify({ cols: '100', rows: 30 }),
      });
      const res = await terminalResize(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('cols and rows must be numbers');
    });

    it('returns 500 when exception occurs', async () => {
      const req = new Request('http://localhost/api/terminal/resize', {
        method: 'POST',
        body: 'invalid-json',
      });
      const res = await terminalResize(req);
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/terminal/stream', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('streams real-time pty output to client and handles heartbeat exceptions', async () => {
      let registeredListener: ((data: string) => void) | null = null;
      vi.mocked(terminalManager.addListener).mockImplementation((listener) => {
        registeredListener = listener;
      });

      const originalEncode = TextEncoder.prototype.encode;
      TextEncoder.prototype.encode = vi.fn().mockImplementation(function (this: TextEncoder, input: string) {
        if (input === ': heartbeat\n\n') {
          throw new Error('Heartbeat error');
        }
        return originalEncode.call(this, input);
      });

      try {
        const res = await terminalStream();
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('text/event-stream');

        const reader = res.body?.getReader();
        expect(reader).toBeDefined();

        // Simulate output from terminal process
        expect(registeredListener).toBeDefined();
        registeredListener!('hello world');

        const decoder = new TextDecoder();
        const { value } = await reader!.read();
        const text = decoder.decode(value);
        expect(text).toContain('hello world');

        // Trigger heartbeat
        await vi.advanceTimersByTimeAsync(15000);

        // Cancel stream to cover cleanup paths
        await reader!.cancel();
        expect(terminalManager.removeListener).toHaveBeenCalled();
      } finally {
        TextEncoder.prototype.encode = originalEncode;
      }
    });
  });

  describe('POST /api/phase extra actions (input, resize, run-gate)', () => {
    const originals = {
      writeStdin: workflowService.writeStdin,
      resize: workflowService.resize,
      runImplementationGate: workflowService.runImplementationGate,
      stop: workflowService.stop,
    };

    afterEach(() => {
      Object.assign(workflowService, originals);
    });

    it('handles action: input', async () => {
      workflowService.writeStdin = vi.fn().mockResolvedValue(true);
      const req = new Request('http://localhost/api/phase', {
        method: 'POST',
        body: JSON.stringify({
          action: 'input',
          phase: 'implementation',
          featureName: 'auth',
          text: 'y\n',
          personaId: 'qa',
        }),
      });
      const res = await managePhase(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
      expect(workflowService.writeStdin).toHaveBeenCalledWith('implementation', 'auth', 'y\n', 'qa');
    });

    it('handles action: resize', async () => {
      workflowService.resize = vi.fn().mockResolvedValue(true);
      const req = new Request('http://localhost/api/phase', {
        method: 'POST',
        body: JSON.stringify({
          action: 'resize',
          phase: 'implementation',
          featureName: 'auth',
          cols: 80,
          rows: 24,
          personaId: 'qa',
        }),
      });
      const res = await managePhase(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
      expect(workflowService.resize).toHaveBeenCalledWith('implementation', 'auth', 80, 24, 'qa');
    });

    it('handles action: stop', async () => {
      workflowService.stop = vi.fn().mockResolvedValue(true);
      const req = new Request('http://localhost/api/phase', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stop',
          phase: 'implementation',
          featureName: 'auth',
          personaId: 'qa',
        }),
      });
      const res = await managePhase(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
      expect(workflowService.stop).toHaveBeenCalledWith('implementation', 'auth', 'qa');
    });

    it('handles action: run-gate', async () => {
      const mockFinalState = { activeFeatureName: 'auth', features: [] };
      workflowService.runImplementationGate = vi.fn().mockResolvedValue(mockFinalState);
      const req = new Request('http://localhost/api/phase', {
        method: 'POST',
        body: JSON.stringify({
          action: 'run-gate',
          phase: 'implementation',
          featureName: 'auth',
          agentConfig: { agentType: 'claude' },
          personas: [{ id: 'qa', enabled: true, command: 'npm test' }],
        }),
      });
      const res = await managePhase(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/event-stream');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let logs = '';
      while (true) {
        const { value, done } = await reader!.read();
        if (done) break;
        logs += decoder.decode(value);
      }
      expect(logs).toContain('event: done');
      expect(logs).toContain(JSON.stringify(mockFinalState));
    });

    it('handles action: run-gate with missing/empty personas', async () => {
      const mockFinalState = { activeFeatureName: 'auth', features: [] };
      workflowService.runImplementationGate = vi.fn().mockResolvedValue(mockFinalState);
      const req = new Request('http://localhost/api/phase', {
        method: 'POST',
        body: JSON.stringify({
          action: 'run-gate',
          phase: 'implementation',
          featureName: 'auth',
          agentConfig: { agentType: 'claude' },
        }),
      });
      const res = await managePhase(req);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/state/watch extra branches', () => {
    const originalGetWorkflowState = workflowService.getWorkflowState;

    afterEach(() => {
      workflowService.getWorkflowState = originalGetWorkflowState;
    });

    it('handles error in state watch sendUpdate gracefully', async () => {
      workflowService.getWorkflowState = vi.fn().mockRejectedValue(new Error('State watch error'));
      
      const res = await watchState();
      expect(res.status).toBe(200);

      // Trigger watch callback with empty string to trigger ternary fallback line 28 (relativePath = null)
      // and test L40 catch block when getWorkflowState rejects.
      if (chokidarCallback) {
        await chokidarCallback('change', '');
      }

      const reader = res.body?.getReader();
      await reader!.cancel();
    });

    it('handles empty string path in state watch sendUpdate successfully', async () => {
      const mockState = { activeFeatureName: 'auth', features: [] };
      workflowService.getWorkflowState = vi.fn().mockResolvedValue(mockState);
      
      const res = await watchState();
      expect(res.status).toBe(200);

      // Trigger watch callback with empty string to trigger ternary fallback line 28 (relativePath = null)
      if (chokidarCallback) {
        await chokidarCallback('change', '');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      const { value } = await reader!.read();
      const text = decoder.decode(value);
      expect(text).toContain('event: update');
      expect(text).toContain('"changedFile":null'); // verifies line 28

      await reader!.cancel();
    });
  });
});
