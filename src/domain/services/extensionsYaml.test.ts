import { describe, it, expect } from 'vitest';
import { toAfterSpecifyHooks, mergeAfterSpecify } from './extensionsYaml';
import { SpecAgentsFile } from '../models/specAgents';

const file: SpecAgentsFile = {
  agents: [
    { id: 'spec-refine', label: 'Refine', command: 'speckit.spec.refine', enabled: true, optional: true, priority: 30 },
    { id: 'spec-po', label: 'PO', command: 'speckit.spec.po', enabled: true, optional: true, priority: 10 },
    { id: 'spec-arch', label: 'Arch', command: 'speckit.spec.architecture', enabled: false, optional: true, priority: 20 },
  ],
};

describe('extensionsYaml', () => {
  it('projects enabled agents sorted by priority, skipping disabled', () => {
    const hooks = toAfterSpecifyHooks(file);
    expect(hooks.map(h => h.id)).toEqual(['spec-po', 'spec-refine']); // arch disabled
    expect(hooks.every(h => h.extension === 'spec-agents')).toBe(true);
  });

  it('merges into existing extensions.yml preserving other events and foreign entries', () => {
    const existing = {
      hooks: {
        before_implement: [{ id: 'pre', extension: 'test-extension', command: 'x' }],
        after_specify: [
          { id: 'foreign', extension: 'other-ext', command: 'keep', priority: 5 },
          { id: 'stale-spec', extension: 'spec-agents', command: 'old', priority: 99 },
        ],
      },
    };
    const merged = mergeAfterSpecify(existing, toAfterSpecifyHooks(file));

    // Other events preserved.
    expect(merged.hooks.before_implement[0].id).toBe('pre');
    // Foreign after_specify entry preserved; stale spec-agents entry replaced.
    const ids = merged.hooks.after_specify.map((e: any) => e.id);
    expect(ids).toContain('foreign');
    expect(ids).not.toContain('stale-spec');
    expect(ids).toEqual(expect.arrayContaining(['spec-po', 'spec-refine']));
    // Sorted by priority (foreign priority 5 first).
    expect(merged.hooks.after_specify[0].id).toBe('foreign');
  });

  it('handles a missing/empty existing config', () => {
    const merged = mergeAfterSpecify(null, toAfterSpecifyHooks(file));
    expect(merged.hooks.after_specify.map((e: any) => e.id)).toEqual(['spec-po', 'spec-refine']);
  });

  it('normalizes a single-object after_specify into a list', () => {
    const existing = { hooks: { after_specify: { id: 'foreign', extension: 'other', command: 'k', priority: 1 } } };
    const merged = mergeAfterSpecify(existing, toAfterSpecifyHooks(file));
    expect(Array.isArray(merged.hooks.after_specify)).toBe(true);
    expect(merged.hooks.after_specify[0].id).toBe('foreign');
  });
});
