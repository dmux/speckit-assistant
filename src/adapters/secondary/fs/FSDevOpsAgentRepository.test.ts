import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FSDevOpsAgentRepository } from './FSDevOpsAgentRepository';
import { DevOpsAgentsFile, DEFAULT_DEVOPS_AGENTS } from '../../../domain/models/devopsAgents';

describe('FSDevOpsAgentRepository', () => {
  let ws: string;
  const repo = new FSDevOpsAgentRepository();

  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), 'devops-agents-'));
  });
  afterEach(() => {
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it('returns DEFAULT_DEVOPS_AGENTS when no roster exists', async () => {
    const file = await repo.getAgents(ws);
    expect(file.agents.map(a => a.id)).toEqual(DEFAULT_DEVOPS_AGENTS.agents.map(a => a.id));
  });

  it('round-trips the roster as YAML', async () => {
    const file: DevOpsAgentsFile = {
      agents: [
        { id: 'devops-deploy', label: 'Deploy', command: 'speckit.devops.deploy', category: 'deploy', enabled: false, model: 'claude-sonnet-4-6', builtin: true },
      ],
    };
    await repo.saveAgents(ws, file);
    const raw = fs.readFileSync(path.join(ws, '.specify', 'devops-agents.yaml'), 'utf-8');
    expect(raw).toMatch(/agents:/);
    const loaded = await repo.getAgents(ws);
    expect(loaded.agents[0].command).toBe('speckit.devops.deploy');
    expect(loaded.agents[0].enabled).toBe(false);
    expect(loaded.agents[0].model).toBe('claude-sonnet-4-6');
  });

  it('falls back to defaults on malformed YAML', async () => {
    fs.mkdirSync(path.join(ws, '.specify'), { recursive: true });
    fs.writeFileSync(path.join(ws, '.specify', 'devops-agents.yaml'), 'not: [valid', 'utf-8');
    const file = await repo.getAgents(ws);
    expect(file.agents.length).toBe(DEFAULT_DEVOPS_AGENTS.agents.length);
  });
});
