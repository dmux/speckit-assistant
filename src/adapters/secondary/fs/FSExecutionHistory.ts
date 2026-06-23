import * as fs from 'fs';
import * as path from 'path';
import { ExecutionHistoryPort } from '../../../domain/ports/out/ExecutionHistoryPort';
import {
  ExecutionRecord,
  ExecutionStartInput,
  ExecutionFinishPatch,
} from '../../../domain/models/executions';

// Append-only execution history persisted under .specify/.runtime:
//   executions.jsonl  — one JSON event per line (start snapshot + finish patch),
//                        reduced by id (last write wins) on read.
//   logs/<id>.log      — captured stdout/stderr for each run.

// Monotonic counter so runs started within the same millisecond keep a stable,
// deterministic order (startedAt alone has ms granularity).
let SEQ = 0;

export class FSExecutionHistory implements ExecutionHistoryPort {
  private runtimeDir(workspacePath: string): string {
    return path.join(workspacePath, '.specify', '.runtime');
  }
  private jsonlPath(workspacePath: string): string {
    return path.join(this.runtimeDir(workspacePath), 'executions.jsonl');
  }
  private logsDir(workspacePath: string): string {
    return path.join(this.runtimeDir(workspacePath), 'logs');
  }
  private logFile(workspacePath: string, id: string): string {
    return path.join(this.logsDir(workspacePath), `${this.safeId(id)}.log`);
  }
  // Ids are generated here, but sanitise defensively before using them in paths.
  private safeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  private appendEvent(workspacePath: string, event: Record<string, unknown>): void {
    const dir = this.runtimeDir(workspacePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(this.jsonlPath(workspacePath), JSON.stringify(event) + '\n', 'utf-8');
  }

  async start(workspacePath: string, input: ExecutionStartInput): Promise<ExecutionRecord> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record: ExecutionRecord = {
      id,
      kind: input.kind,
      feature: input.feature,
      ...(input.phase ? { phase: input.phase } : {}),
      ...(input.agentId ? { agentId: input.agentId } : {}),
      label: input.label,
      ...(input.command ? { command: input.command } : {}),
      status: 'running',
      startedAt: Date.now(),
      seq: SEQ++,
      logPath: path.join('.specify', '.runtime', 'logs', `${id}.log`),
    };
    this.appendEvent(workspacePath, record as unknown as Record<string, unknown>);
    // Touch the log file so the path exists even for a silent run.
    try {
      if (!fs.existsSync(this.logsDir(workspacePath))) fs.mkdirSync(this.logsDir(workspacePath), { recursive: true });
      fs.writeFileSync(this.logFile(workspacePath, id), '', { flag: 'a' });
    } catch {
      // best-effort
    }
    return record;
  }

  appendLog(workspacePath: string, id: string, text: string): void {
    try {
      const dir = this.logsDir(workspacePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(this.logFile(workspacePath, id), text, 'utf-8');
    } catch {
      // logging is best-effort; never block a run on it
    }
  }

  async finish(workspacePath: string, id: string, patch: ExecutionFinishPatch): Promise<void> {
    this.appendEvent(workspacePath, {
      id,
      status: patch.status,
      completedAt: Date.now(),
      ...(typeof patch.exitCode === 'number' ? { exitCode: patch.exitCode } : {}),
      ...(patch.cost ? { cost: patch.cost } : {}),
    });
  }

  async list(workspacePath: string, filter?: { feature?: string }): Promise<ExecutionRecord[]> {
    const fp = this.jsonlPath(workspacePath);
    if (!fs.existsSync(fp)) return [];
    const merged = new Map<string, ExecutionRecord>();
    const lines = fs.readFileSync(fp, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event: any;
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (!event || typeof event.id !== 'string') continue;
      const prev = merged.get(event.id);
      merged.set(event.id, { ...(prev || {}), ...event } as ExecutionRecord);
    }
    let records = [...merged.values()].filter(r => typeof r.startedAt === 'number');
    if (filter?.feature) records = records.filter(r => r.feature === filter.feature);
    return records.sort((a, b) => b.startedAt - a.startedAt || (b.seq ?? 0) - (a.seq ?? 0));
  }

  async readLog(workspacePath: string, id: string): Promise<string> {
    const fp = this.logFile(workspacePath, id);
    if (!fs.existsSync(fp)) return '';
    try {
      return fs.readFileSync(fp, 'utf-8');
    } catch {
      return '';
    }
  }
}
