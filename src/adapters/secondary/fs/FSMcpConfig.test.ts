import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse as parseToml } from 'smol-toml';
import { FSMcpConfig } from './FSMcpConfig';
import { McpFile } from '../../../domain/models/mcp';
import { AgentProfile } from '../../../domain/models/agents';

describe('FSMcpConfig', () => {
  let ws: string;
  let home: string;
  let origHome: string | undefined;
  const cfg = new FSMcpConfig();

  const file: McpFile = {
    servers: [
      { id: 's1', name: 'github', transport: 'stdio', command: 'npx', args: ['-y', 'srv'], enabled: true },
      { id: 's2', name: 'off', transport: 'stdio', command: 'x', enabled: false },
    ],
  };

  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-ws-'));
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-home-'));
    origHome = process.env.HOME;
    process.env.HOME = home;
  });
  afterEach(() => {
    process.env.HOME = origHome;
    fs.rmSync(ws, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('round-trips the server list as YAML', async () => {
    await cfg.saveServers(ws, file);
    const reloaded = await cfg.getServers(ws);
    expect(reloaded.servers.map(s => s.id)).toEqual(['s1', 's2']);
  });

  it('applies a claude agent to a merged project .mcp.json (only enabled+assigned)', async () => {
    // Pre-existing unrelated server must be preserved.
    fs.writeFileSync(path.join(ws, '.mcp.json'), JSON.stringify({ mcpServers: { keep: { command: 'old' } } }), 'utf-8');
    const agent: AgentProfile = { id: 'a', name: 'c', agentType: 'claude', mcpServerIds: ['s1', 's2'] };

    const res = await cfg.applyToAgent(ws, agent, file);
    expect(res.path).toBe(path.join(ws, '.mcp.json'));
    expect(res.serverCount).toBe(1); // s2 is disabled

    const written = JSON.parse(fs.readFileSync(path.join(ws, '.mcp.json'), 'utf-8'));
    expect(written.mcpServers.keep.command).toBe('old'); // preserved
    expect(written.mcpServers.github.command).toBe('npx'); // added
    expect(written.mcpServers.off).toBeUndefined(); // disabled, skipped
  });

  it('applies an openai agent to ~/.codex/config.toml as TOML', async () => {
    const agent: AgentProfile = { id: 'a', name: 'o', agentType: 'openai', mcpServerIds: ['s1'] };
    const res = await cfg.applyToAgent(ws, agent, file);
    expect(res.path).toBe(path.join(home, '.codex', 'config.toml'));

    const parsed: any = parseToml(fs.readFileSync(res.path, 'utf-8'));
    expect(parsed.mcp_servers.github.command).toBe('npx');
  });

  it('applies a gemini agent to ~/.gemini/settings.json', async () => {
    const agent: AgentProfile = { id: 'a', name: 'g', agentType: 'gemini', mcpServerIds: ['s1'] };
    const res = await cfg.applyToAgent(ws, agent, file);
    expect(res.path).toBe(path.join(home, '.gemini', 'settings.json'));
    const parsed = JSON.parse(fs.readFileSync(res.path, 'utf-8'));
    expect(parsed.mcpServers.github.command).toBe('npx');
  });
});
