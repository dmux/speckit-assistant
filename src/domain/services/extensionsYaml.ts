import { SpecAgentsFile, SPEC_AGENTS_EXTENSION_ID } from '../models/specAgents';

// A spec-kit hook entry as it appears under hooks.<event> in .specify/extensions.yml.
export type HookEntry = {
  id: string;
  extension: string;
  command: string;
  enabled?: boolean;
  optional?: boolean;
  priority?: number;
  description?: string;
  prompt?: string;
};

// Project the enabled spec agents (priority-ordered) into after_specify hook entries.
export function toAfterSpecifyHooks(file: SpecAgentsFile): HookEntry[] {
  return [...file.agents]
    .filter(a => a.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map(a => ({
      id: a.id,
      extension: SPEC_AGENTS_EXTENSION_ID,
      command: a.command,
      enabled: true,
      optional: a.optional,
      priority: a.priority,
      ...(a.description ? { description: a.description } : {}),
    }));
}

// Merge our managed after_specify entries into an existing extensions.yml object.
// Preserves every other hook event and every entry NOT owned by the spec-agents
// extension; replaces the set of spec-agents-owned after_specify entries.
export function mergeAfterSpecify(existing: any, managed: HookEntry[]): any {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  const hooks = { ...(base.hooks || {}) };

  const raw = hooks.after_specify;
  const current: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const others = current.filter(e => e?.extension !== SPEC_AGENTS_EXTENSION_ID);

  const next = [...others, ...managed].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  hooks.after_specify = next;

  return { ...base, hooks };
}
