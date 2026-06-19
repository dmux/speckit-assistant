import { spawn } from 'child_process';
import { SpecifyCliPort, SpecifyRunResult } from '../../../domain/ports/out/SpecifyCliPort';

const BIN = process.env.SPECIFY_BIN || 'specify';
const TIMEOUT_MS = 180_000;

export class ProcessSpecifyRunner implements SpecifyCliPort {
  async isAvailable(): Promise<boolean> {
    try {
      const { code } = await this.exec(process.cwd(), ['--version'], 8000);
      return code === 0;
    } catch {
      return false;
    }
  }

  run(workspacePath: string, args: string[]): Promise<SpecifyRunResult> {
    return this.exec(workspacePath, args, TIMEOUT_MS);
  }

  private exec(cwd: string, args: string[], timeoutMs: number): Promise<SpecifyRunResult> {
    return new Promise((resolve) => {
      let output = '';
      let settled = false;
      const finish = (code: number) => {
        if (settled) return;
        settled = true;
        resolve({ code, output });
      };

      let child;
      try {
        child = spawn(BIN, args, { cwd, env: process.env });
      } catch (err: any) {
        resolve({ code: 127, output: `Failed to start ${BIN}: ${err.message}` });
        return;
      }

      const timer = setTimeout(() => {
        try { child.kill(); } catch { /* ignore */ }
        output += `\n[timed out after ${Math.round(timeoutMs / 1000)}s]`;
        finish(124);
      }, timeoutMs);

      child.stdout?.on('data', (d) => { output += d.toString(); });
      child.stderr?.on('data', (d) => { output += d.toString(); });

      // Auto-confirm any interactive prompt (e.g. the untrusted-URL confirmation).
      try {
        child.stdin?.write('y\n');
        child.stdin?.end();
      } catch {
        /* ignore */
      }

      child.on('error', (err) => {
        clearTimeout(timer);
        output += `\n${BIN} error: ${err.message}`;
        finish(127);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        finish(code ?? 0);
      });
    });
  }
}
