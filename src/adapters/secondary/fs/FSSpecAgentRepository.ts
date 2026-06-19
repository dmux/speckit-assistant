import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SpecAgentRepositoryPort, SpecAgentApplyResult } from '../../../domain/ports/out/SpecAgentRepositoryPort';
import { SpecAgentsFile, DEFAULT_SPEC_AGENTS, SpecAgent } from '../../../domain/models/specAgents';
import { toAfterSpecifyHooks, mergeAfterSpecify } from '../../../domain/services/extensionsYaml';

export class FSSpecAgentRepository implements SpecAgentRepositoryPort {
  private rosterPath(workspacePath: string): string {
    return path.join(workspacePath, '.specify', 'spec-agents.yaml');
  }
  private extensionsPath(workspacePath: string): string {
    return path.join(workspacePath, '.specify', 'extensions.yml');
  }
  private customCommandPath(workspacePath: string, id: string): string {
    return path.join(workspacePath, '.specify', 'spec-agents', 'commands', `${id}.md`);
  }

  async getAgents(workspacePath: string): Promise<SpecAgentsFile> {
    const fp = this.rosterPath(workspacePath);
    if (!fs.existsSync(fp)) return JSON.parse(JSON.stringify(DEFAULT_SPEC_AGENTS));
    try {
      const parsed = yaml.load(fs.readFileSync(fp, 'utf-8')) as SpecAgentsFile;
      if (!parsed || !Array.isArray(parsed.agents)) return JSON.parse(JSON.stringify(DEFAULT_SPEC_AGENTS));
      return { agents: parsed.agents };
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_SPEC_AGENTS));
    }
  }

  async saveAgents(workspacePath: string, file: SpecAgentsFile): Promise<void> {
    const dir = path.join(workspacePath, '.specify');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.rosterPath(workspacePath), yaml.dump(file, { lineWidth: 120 }), 'utf-8');
  }

  async applyToSpecKit(workspacePath: string, file: SpecAgentsFile): Promise<SpecAgentApplyResult> {
    // 1. Write command files for custom (non-builtin) enabled agents that carry a prompt.
    const customWritten: string[] = [];
    for (const agent of file.agents) {
      if (!agent.builtin && agent.enabled && agent.systemPrompt) {
        const target = this.customCommandPath(workspacePath, agent.id);
        this.backupAndWrite(target, this.renderCustomCommand(agent));
        customWritten.push(target);
      }
    }

    // 2. Merge our after_specify hooks into .specify/extensions.yml, preserving the rest.
    const extPath = this.extensionsPath(workspacePath);
    let existing: any = {};
    if (fs.existsSync(extPath)) {
      try {
        existing = yaml.load(fs.readFileSync(extPath, 'utf-8')) || {};
      } catch {
        existing = {};
      }
    }
    const hooks = toAfterSpecifyHooks(file);
    const merged = mergeAfterSpecify(existing, hooks);
    this.backupAndWrite(extPath, yaml.dump(merged, { lineWidth: 120 }));

    return { path: extPath, hookCount: hooks.length, customWritten };
  }

  private renderCustomCommand(agent: SpecAgent): string {
    return `---
description: "${agent.label} — custom specification agent."
---

# Spec Agent: ${agent.label}

${agent.systemPrompt || ''}

## Context
The feature directory is: \`$ARGUMENTS\` (e.g. \`specs/001-my-feature\`).

## Output
Write your contribution to \`$ARGUMENTS/spec-reviews/${agent.id}.md\`. Do **not** edit \`spec.md\`
directly — the consolidate agent integrates the contributions. End with a one-line \`SUMMARY:\`.
`;
  }

  private backupAndWrite(target: string, content: string): void {
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(target)) {
      try {
        fs.copyFileSync(target, `${target}.bak`);
      } catch {
        // best-effort backup
      }
    }
    fs.writeFileSync(target, content, 'utf-8');
  }
}
