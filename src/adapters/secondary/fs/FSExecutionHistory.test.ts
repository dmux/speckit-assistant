import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FSExecutionHistory } from './FSExecutionHistory';

describe('FSExecutionHistory', () => {
  let ws: string;
  const repo = new FSExecutionHistory();

  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-history-'));
  });
  afterEach(() => {
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it('returns [] when no history exists', async () => {
    expect(await repo.list(ws)).toEqual([]);
  });

  it('merges start + finish into a single record by id', async () => {
    const rec = await repo.start(ws, { kind: 'devops', feature: 'auth', agentId: 'devops-deploy', label: 'Deploy', command: 'speckit.devops.deploy' });
    let list = await repo.list(ws);
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('running');

    await repo.finish(ws, rec.id, { status: 'passed', exitCode: 0, cost: { source: 'estimated', durationMs: 1234 } });
    list = await repo.list(ws);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(rec.id);
    expect(list[0].status).toBe('passed');
    expect(list[0].exitCode).toBe(0);
    expect(list[0].completedAt).toBeGreaterThanOrEqual(list[0].startedAt);
    expect(list[0].cost?.durationMs).toBe(1234);
    // Original start fields survive the merge.
    expect(list[0].label).toBe('Deploy');
    expect(list[0].feature).toBe('auth');
  });

  it('captures and reads back the run log', async () => {
    const rec = await repo.start(ws, { kind: 'phase', feature: 'auth', phase: 'specification', label: 'specification' });
    repo.appendLog(ws, rec.id, 'line one\n');
    repo.appendLog(ws, rec.id, 'line two\n');
    expect(await repo.readLog(ws, rec.id)).toBe('line one\nline two\n');
  });

  it('filters by feature and sorts newest first', async () => {
    // Ordering is deterministic via the monotonic seq tiebreaker even when the
    // runs share a millisecond, so no sleeps are needed.
    const a = await repo.start(ws, { kind: 'phase', feature: 'auth', label: 'a' });
    const b = await repo.start(ws, { kind: 'phase', feature: 'billing', label: 'b' });
    const c = await repo.start(ws, { kind: 'phase', feature: 'auth', label: 'c' });

    const authOnly = await repo.list(ws, { feature: 'auth' });
    expect(authOnly.map(r => r.id)).toEqual([c.id, a.id]);
    expect((await repo.list(ws)).map(r => r.id)).toEqual([c.id, b.id, a.id]);
  });
});
