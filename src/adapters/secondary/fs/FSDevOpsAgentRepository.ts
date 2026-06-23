import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { DevOpsAgentRepositoryPort } from '../../../domain/ports/out/DevOpsAgentRepositoryPort';
import { DevOpsAgentsFile, DEFAULT_DEVOPS_AGENTS } from '../../../domain/models/devopsAgents';

export class FSDevOpsAgentRepository implements DevOpsAgentRepositoryPort {
  private rosterPath(workspacePath: string): string {
    return path.join(workspacePath, '.specify', 'devops-agents.yaml');
  }

  async getAgents(workspacePath: string): Promise<DevOpsAgentsFile> {
    const fp = this.rosterPath(workspacePath);
    if (!fs.existsSync(fp)) return JSON.parse(JSON.stringify(DEFAULT_DEVOPS_AGENTS));
    try {
      const parsed = yaml.load(fs.readFileSync(fp, 'utf-8')) as DevOpsAgentsFile;
      if (!parsed || !Array.isArray(parsed.agents)) return JSON.parse(JSON.stringify(DEFAULT_DEVOPS_AGENTS));
      return { agents: parsed.agents };
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_DEVOPS_AGENTS));
    }
  }

  async saveAgents(workspacePath: string, file: DevOpsAgentsFile): Promise<void> {
    const dir = path.join(workspacePath, '.specify');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.rosterPath(workspacePath), yaml.dump(file, { lineWidth: 120 }), 'utf-8');
  }
}
