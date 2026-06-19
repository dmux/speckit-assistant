import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AgentRepositoryPort } from '../../../domain/ports/out/AgentRepositoryPort';
import { AgentsFile, DEFAULT_AGENTS } from '../../../domain/models/agents';

export class FSAgentRepository implements AgentRepositoryPort {
  private filePath(workspacePath: string): string {
    return path.join(workspacePath, '.specify', 'agents.yaml');
  }

  async getAgents(workspacePath: string): Promise<AgentsFile> {
    const fp = this.filePath(workspacePath);
    if (!fs.existsSync(fp)) {
      return JSON.parse(JSON.stringify(DEFAULT_AGENTS));
    }
    try {
      const parsed = yaml.load(fs.readFileSync(fp, 'utf-8')) as AgentsFile;
      if (!parsed || !Array.isArray(parsed.agents)) {
        return JSON.parse(JSON.stringify(DEFAULT_AGENTS));
      }
      return {
        agents: parsed.agents,
        activeAgentId: parsed.activeAgentId ?? parsed.agents[0]?.id ?? null,
      };
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_AGENTS));
    }
  }

  async saveAgents(workspacePath: string, file: AgentsFile): Promise<void> {
    const dir = path.join(workspacePath, '.specify');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath(workspacePath), yaml.dump(file, { lineWidth: 120 }), 'utf-8');
  }
}
