import { describe, it, expect } from 'vitest';
import { parse as parseToml } from 'smol-toml';
import {
  toClaudeMcp,
  toGeminiServers,
  toCodexServers,
  mergeJsonMcp,
  mergeTomlMcp,
} from './mcpTranslate';
import { McpServer } from '../models/mcp';

const stdio: McpServer = {
  id: '1', name: 'github', transport: 'stdio',
  command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_TOKEN: 'x' }, enabled: true,
};
const http: McpServer = {
  id: '2', name: 'remote', transport: 'http', url: 'https://example.com/mcp', enabled: true,
};

describe('mcpTranslate', () => {
  it('toClaudeMcp emits stdio command/args/env and typed http url', () => {
    const map = toClaudeMcp([stdio, http]);
    expect(map.github).toEqual({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_TOKEN: 'x' } });
    expect(map.remote).toEqual({ type: 'http', url: 'https://example.com/mcp' });
  });

  it('toGeminiServers maps http to httpUrl', () => {
    const map = toGeminiServers([stdio, http]);
    expect(map.github.command).toBe('npx');
    expect(map.remote).toEqual({ httpUrl: 'https://example.com/mcp' });
  });

  it('toCodexServers keeps stdio and notes non-stdio as unsupported', () => {
    const { map, notes } = toCodexServers([stdio, http]);
    expect(map.github).toEqual({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_TOKEN: 'x' } });
    expect(map.remote).toBeUndefined();
    expect(notes.join(' ')).toMatch(/stdio/i);
  });

  it('mergeJsonMcp upserts by name and preserves other keys/servers', () => {
    const existing = { theme: 'dark', mcpServers: { keep: { command: 'old' }, github: { command: 'stale' } } };
    const merged = mergeJsonMcp(existing, toClaudeMcp([stdio]));
    expect(merged.theme).toBe('dark');               // unrelated key preserved
    expect(merged.mcpServers.keep).toEqual({ command: 'old' }); // unmanaged server preserved
    expect(merged.mcpServers.github.command).toBe('npx');       // managed server upserted
  });

  it('mergeJsonMcp tolerates empty/invalid existing', () => {
    expect(mergeJsonMcp(null, { a: { command: 'x' } })).toEqual({ mcpServers: { a: { command: 'x' } } });
  });

  it('mergeTomlMcp upserts the mcp_servers table while preserving other tables', () => {
    const existing = '[history]\npersistence = "save-all"\n\n[mcp_servers.keep]\ncommand = "old"\n';
    const out = mergeTomlMcp(existing, toCodexServers([stdio]).map);
    const parsed: any = parseToml(out);
    expect(parsed.history.persistence).toBe('save-all');     // unrelated table preserved
    expect(parsed.mcp_servers.keep.command).toBe('old');     // unmanaged server preserved
    expect(parsed.mcp_servers.github.command).toBe('npx');   // managed server added
  });
});
