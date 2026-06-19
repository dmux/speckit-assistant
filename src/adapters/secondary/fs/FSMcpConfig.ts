import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { McpConfigPort, McpApplyResult } from '../../../domain/ports/out/McpConfigPort';
import { McpFile, DEFAULT_MCP, McpServer } from '../../../domain/models/mcp';
import { AgentProfile } from '../../../domain/models/agents';
import {
  toClaudeMcp,
  toGeminiServers,
  toCodexServers,
  mergeJsonMcp,
  mergeTomlMcp,
} from '../../../domain/services/mcpTranslate';

export class FSMcpConfig implements McpConfigPort {
  private filePath(workspacePath: string): string {
    return path.join(workspacePath, '.specify', 'mcp.yaml');
  }

  async getServers(workspacePath: string): Promise<McpFile> {
    const fp = this.filePath(workspacePath);
    if (!fs.existsSync(fp)) return JSON.parse(JSON.stringify(DEFAULT_MCP));
    try {
      const parsed = yaml.load(fs.readFileSync(fp, 'utf-8')) as McpFile;
      if (!parsed || !Array.isArray(parsed.servers)) return JSON.parse(JSON.stringify(DEFAULT_MCP));
      return { servers: parsed.servers };
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_MCP));
    }
  }

  async saveServers(workspacePath: string, file: McpFile): Promise<void> {
    const dir = path.join(workspacePath, '.specify');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath(workspacePath), yaml.dump(file, { lineWidth: 120 }), 'utf-8');
  }

  async applyToAgent(workspacePath: string, agent: AgentProfile, file: McpFile): Promise<McpApplyResult> {
    const assigned = new Set(agent.mcpServerIds || []);
    const servers: McpServer[] = file.servers.filter(s => s.enabled && assigned.has(s.id));

    const home = process.env.HOME || os.homedir();

    if (agent.agentType === 'openai') {
      // Codex: ~/.codex/config.toml (TOML, stdio only)
      const target = path.join(home, '.codex', 'config.toml');
      const { map, notes } = toCodexServers(servers);
      const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : '';
      this.backupAndWrite(target, mergeTomlMcp(existing, map));
      return { agentType: agent.agentType, path: target, serverCount: Object.keys(map).length, notes };
    }

    if (agent.agentType === 'gemini') {
      const target = path.join(home, '.gemini', 'settings.json');
      const map = toGeminiServers(servers);
      this.writeJsonMerged(target, map);
      return { agentType: agent.agentType, path: target, serverCount: Object.keys(map).length, notes: [] };
    }

    // claude (workspace .mcp.json), and copilot/custom fall back to the same
    // project-level file (read natively by Claude Code; portable for others).
    const target = path.join(workspacePath, '.mcp.json');
    const map = toClaudeMcp(servers);
    this.writeJsonMerged(target, map);
    const notes =
      agent.agentType === 'claude'
        ? []
        : [`Wrote project .mcp.json; the "${agent.agentType}" CLI may need manual wiring to read it.`];
    return { agentType: agent.agentType, path: target, serverCount: Object.keys(map).length, notes };
  }

  private writeJsonMerged(target: string, incoming: Record<string, any>): void {
    let existing: any = {};
    if (fs.existsSync(target)) {
      try {
        existing = JSON.parse(fs.readFileSync(target, 'utf-8'));
      } catch {
        existing = {};
      }
    }
    this.backupAndWrite(target, JSON.stringify(mergeJsonMcp(existing, incoming), null, 2) + '\n');
  }

  // Ensure the parent dir, back up an existing file once, then write.
  private backupAndWrite(target: string, content: string): void {
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(target)) {
      try {
        fs.copyFileSync(target, `${target}.bak`);
      } catch {
        // backup is best-effort
      }
    }
    fs.writeFileSync(target, content, 'utf-8');
  }
}
