import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { McpServer } from '../models/mcp';

// Translators turn our transport-agnostic McpServer[] into the native config
// shape each CLI expects. They are pure: callers pass the already-filtered list
// (enabled + assigned to the agent) and merge the result into existing files.

type ServerMap = Record<string, any>;

const hasEnv = (s: McpServer) => s.env && Object.keys(s.env).length > 0;
const hasArgs = (s: McpServer) => Array.isArray(s.args) && s.args.length > 0;

// --- Claude Code (.mcp.json) ---
function claudeEntry(s: McpServer): any {
  if (s.transport === 'stdio') {
    return {
      command: s.command,
      ...(hasArgs(s) ? { args: s.args } : {}),
      ...(hasEnv(s) ? { env: s.env } : {}),
    };
  }
  // http | sse — Claude uses an explicit type + url
  return { type: s.transport, url: s.url };
}

export function toClaudeMcp(servers: McpServer[]): ServerMap {
  const map: ServerMap = {};
  for (const s of servers) map[s.name] = claudeEntry(s);
  return map;
}

// --- Gemini CLI (~/.gemini/settings.json) ---
function geminiEntry(s: McpServer): any {
  if (s.transport === 'stdio') {
    return {
      command: s.command,
      ...(hasArgs(s) ? { args: s.args } : {}),
      ...(hasEnv(s) ? { env: s.env } : {}),
    };
  }
  // Gemini uses httpUrl for streamable HTTP and url for SSE.
  return s.transport === 'http' ? { httpUrl: s.url } : { url: s.url };
}

export function toGeminiServers(servers: McpServer[]): ServerMap {
  const map: ServerMap = {};
  for (const s of servers) map[s.name] = geminiEntry(s);
  return map;
}

// --- Codex CLI (~/.codex/config.toml) — stdio only ---
export function toCodexServers(servers: McpServer[]): { map: ServerMap; notes: string[] } {
  const map: ServerMap = {};
  const notes: string[] = [];
  for (const s of servers) {
    if (s.transport !== 'stdio') {
      notes.push(`Server "${s.name}" (${s.transport}) skipped: Codex supports stdio MCP servers only.`);
      continue;
    }
    map[s.name] = {
      command: s.command,
      ...(hasArgs(s) ? { args: s.args } : {}),
      ...(hasEnv(s) ? { env: s.env } : {}),
    };
  }
  return { map, notes };
}

// --- Merge helpers: upsert by name, preserve everything else ---
export function mergeJsonMcp(existing: any, incoming: ServerMap): any {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  return {
    ...base,
    mcpServers: { ...(base.mcpServers || {}), ...incoming },
  };
}

export function mergeTomlMcp(existingToml: string, incoming: ServerMap): string {
  let data: any = {};
  if (existingToml && existingToml.trim().length > 0) {
    try {
      data = parseToml(existingToml);
    } catch {
      data = {};
    }
  }
  const merged = {
    ...data,
    mcp_servers: { ...(data.mcp_servers || {}), ...incoming },
  };
  return stringifyToml(merged);
}
