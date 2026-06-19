import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { FSSpecAgentRepository } from './FSSpecAgentRepository';
import { SpecAgentsFile, DEFAULT_SPEC_AGENTS } from '../../../domain/models/specAgents';

describe('FSSpecAgentRepository', () => {
  let ws: string;
  const repo = new FSSpecAgentRepository();

  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-agents-'));
  });
  afterEach(() => {
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it('returns DEFAULT_SPEC_AGENTS when no roster exists', async () => {
    const file = await repo.getAgents(ws);
    expect(file.agents.map(a => a.id)).toEqual(DEFAULT_SPEC_AGENTS.agents.map(a => a.id));
  });

  it('round-trips the roster as YAML', async () => {
    const file: SpecAgentsFile = {
      agents: [{ id: 'spec-po', label: 'PO', command: 'speckit.spec.po', enabled: true, optional: true, priority: 10, builtin: true }],
    };
    await repo.saveAgents(ws, file);
    const raw = fs.readFileSync(path.join(ws, '.specify', 'spec-agents.yaml'), 'utf-8');
    expect(raw).toMatch(/agents:/);
    expect((await repo.getAgents(ws)).agents[0].command).toBe('speckit.spec.po');
  });

  it('applies hooks into extensions.yml preserving other events/entries', async () => {
    // Seed an existing extensions.yml with an unrelated hook + a foreign after_specify entry.
    fs.mkdirSync(path.join(ws, '.specify'), { recursive: true });
    fs.writeFileSync(
      path.join(ws, '.specify', 'extensions.yml'),
      yaml.dump({
        hooks: {
          before_implement: [{ id: 'pre', extension: 'other', command: 'x' }],
          after_specify: [{ id: 'foreign', extension: 'other', command: 'keep', priority: 5 }],
        },
      }),
      'utf-8'
    );

    const file: SpecAgentsFile = {
      agents: [
        { id: 'spec-po', label: 'PO', command: 'speckit.spec.po', enabled: true, optional: true, priority: 10, builtin: true },
        { id: 'spec-arch', label: 'Arch', command: 'speckit.spec.architecture', enabled: false, optional: true, priority: 20, builtin: true },
      ],
    };

    const res = await repo.applyToSpecKit(ws, file);
    expect(res.path).toBe(path.join(ws, '.specify', 'extensions.yml'));
    expect(res.hookCount).toBe(1); // only the enabled PO

    const parsed: any = yaml.load(fs.readFileSync(res.path, 'utf-8'));
    expect(parsed.hooks.before_implement[0].id).toBe('pre'); // preserved
    const ids = parsed.hooks.after_specify.map((e: any) => e.id);
    expect(ids).toContain('foreign'); // foreign preserved
    expect(ids).toContain('spec-po'); // managed added
    expect(ids).not.toContain('spec-arch'); // disabled skipped
  });

  it('writes a command file for a custom agent with a prompt', async () => {
    const file: SpecAgentsFile = {
      agents: [{ id: 'qa-spec', label: 'Spec QA', command: 'speckit.spec.qa-spec', systemPrompt: 'Check testability.', enabled: true, optional: true, priority: 40 }],
    };
    const res = await repo.applyToSpecKit(ws, file);
    const cmd = path.join(ws, '.specify', 'spec-agents', 'commands', 'qa-spec.md');
    expect(res.customWritten).toContain(cmd);
    expect(fs.readFileSync(cmd, 'utf-8')).toMatch(/Check testability/);
  });
});
