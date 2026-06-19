import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FSAgentRepository } from './FSAgentRepository';
import { DEFAULT_AGENTS } from '../../../domain/models/agents';

describe('FSAgentRepository', () => {
  let ws: string;
  const repo = new FSAgentRepository();

  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-test-'));
  });
  afterEach(() => {
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it('returns DEFAULT_AGENTS when no file exists', async () => {
    const file = await repo.getAgents(ws);
    expect(file.agents.length).toBe(DEFAULT_AGENTS.agents.length);
    expect(file.activeAgentId).toBe('claude-default');
  });

  it('persists and reloads agents as YAML', async () => {
    await repo.saveAgents(ws, {
      agents: [
        { id: 'a1', name: 'Claude', agentType: 'claude', model: 'claude-opus', mcpServerIds: ['s1'], enabled: true },
        { id: 'a2', name: 'Gemini', agentType: 'gemini' },
      ],
      activeAgentId: 'a2',
    });

    // Written as real YAML, not JSON.
    const raw = fs.readFileSync(path.join(ws, '.specify', 'agents.yaml'), 'utf-8');
    expect(raw).toMatch(/agents:/);
    expect(raw.trim().startsWith('{')).toBe(false);

    const reloaded = await repo.getAgents(ws);
    expect(reloaded.activeAgentId).toBe('a2');
    expect(reloaded.agents.find(a => a.id === 'a1')?.mcpServerIds).toEqual(['s1']);
  });
});
