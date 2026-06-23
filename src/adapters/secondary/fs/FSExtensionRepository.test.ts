import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FSExtensionRepository } from './FSExtensionRepository';

describe('FSExtensionRepository', () => {
  let ws: string;
  const repo = new FSExtensionRepository();

  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-repo-'));
  });
  afterEach(() => {
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it('returns [] when no registry exists', async () => {
    expect(await repo.listInstalled(ws)).toEqual([]);
  });

  it('reads the registry + manifest into installed extensions', async () => {
    const extDir = path.join(ws, '.specify', 'extensions');
    fs.mkdirSync(path.join(extDir, 'spec-agents'), { recursive: true });
    fs.writeFileSync(
      path.join(extDir, '.registry'),
      JSON.stringify({ schema_version: '1.0', extensions: { 'spec-agents': { version: '1.0.0', source: 'local', enabled: false, priority: 20 } } }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(extDir, 'spec-agents', 'extension.yml'),
      [
        'schema_version: "1.0"',
        'extension:',
        '  id: "spec-agents"',
        '  name: "Spec Agents"',
        '  version: "1.0.0"',
        '  description: "Specification agents."',
        'provides:',
        '  commands:',
        '    - name: "speckit.spec-agents.po"',
        '      file: "commands/po.md"',
        '    - name: "speckit.spec-agents.architecture"',
        '      file: "commands/architecture.md"',
        'hooks:',
        '  after_specify:',
        '    - id: spec-po',
        '      command: "speckit.spec-agents.po"',
      ].join('\n'),
      'utf-8'
    );

    const list = await repo.listInstalled(ws);
    expect(list).toHaveLength(1);
    const ext = list[0];
    expect(ext.id).toBe('spec-agents');
    expect(ext.name).toBe('Spec Agents');
    expect(ext.enabled).toBe(false);
    expect(ext.commandCount).toBe(2);
    expect(ext.hookCount).toBe(1);
    expect(ext.priority).toBe(20);
    expect(ext.description).toBe('Specification agents.');
  });
});
