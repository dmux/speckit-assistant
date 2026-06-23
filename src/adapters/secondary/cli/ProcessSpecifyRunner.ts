import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SpecifyCliPort, SpecifyRunResult } from '../../../domain/ports/out/SpecifyCliPort';

// Source zip used to install the CLI without requiring `git` on the host.
const SPEC_KIT_ZIP_URL =
  process.env.SPEC_KIT_ZIP_URL || 'https://github.com/github/spec-kit/archive/refs/heads/main.zip';
const TIMEOUT_MS = 180_000;
const INSTALL_TIMEOUT_MS = 300_000;
const IS_WIN = process.platform === 'win32';
const UV_EXE = IS_WIN ? 'uv.exe' : 'uv';
const PY_EXE = IS_WIN ? 'python.exe' : 'python';
const SPECIFY_EXE = IS_WIN ? 'specify.exe' : 'specify';

// Bin dir name inside a virtualenv differs per platform.
function venvBin(root: string): string {
  return path.join(root, IS_WIN ? 'Scripts' : 'bin');
}

// Candidate venv roots, most specific first: an active venv ($VIRTUAL_ENV),
// then common local venv layouts inside the workspace.
function venvRootCandidates(workspacePath?: string): string[] {
  const roots: string[] = [];
  if (process.env.VIRTUAL_ENV) roots.push(process.env.VIRTUAL_ENV);
  if (workspacePath) {
    for (const name of ['.venv', 'venv', 'env']) roots.push(path.join(workspacePath, name));
  }
  return roots;
}

// The first candidate venv that actually contains a python interpreter, or null.
function resolveVenvRoot(workspacePath?: string): string | null {
  for (const root of venvRootCandidates(workspacePath)) {
    if (fs.existsSync(path.join(venvBin(root), PY_EXE))) return root;
  }
  return null;
}

function venvBinDirs(workspacePath?: string): string[] {
  return venvRootCandidates(workspacePath).map(venvBin);
}

// Resolve the `specify` binary, preferring the project's local venv over PATH.
// An explicit SPECIFY_BIN env wins.
function resolveSpecifyBin(workspacePath?: string): string {
  if (process.env.SPECIFY_BIN) return process.env.SPECIFY_BIN;
  const venv = resolveVenvRoot(workspacePath);
  if (venv) {
    const candidate = path.join(venvBin(venv), SPECIFY_EXE);
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'specify';
}

// Resolve the `uv` binary. An explicit UV_BIN env wins; otherwise prefer a
// venv-local uv (workspace's .venv, or an active $VIRTUAL_ENV) before falling
// back to `uv` on PATH.
function resolveUvBin(workspacePath?: string): string {
  if (process.env.UV_BIN) return process.env.UV_BIN;
  for (const dir of venvBinDirs(workspacePath)) {
    const candidate = path.join(dir, UV_EXE);
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'uv';
}

// Keep a venv-local `specify`/`python` and the uv tool bin dir (~/.local/bin,
// the global fallback target) discoverable to spawned processes.
function augmentedEnv(workspacePath?: string): NodeJS.ProcessEnv {
  const extra = [...venvBinDirs(workspacePath), path.join(os.homedir(), '.local', 'bin')];
  const sep = IS_WIN ? ';' : ':';
  const current = process.env.PATH || '';
  const parts = current.split(sep);
  const missing = extra.filter(p => p && !parts.includes(p));
  return missing.length ? { ...process.env, PATH: [...missing, ...parts].join(sep) } : process.env;
}

export class ProcessSpecifyRunner implements SpecifyCliPort {
  async isAvailable(workspacePath?: string): Promise<boolean> {
    try {
      const { code } = await this.exec(resolveSpecifyBin(workspacePath), workspacePath ?? process.cwd(), ['--version'], 8000);
      return code === 0;
    } catch {
      return false;
    }
  }

  run(workspacePath: string, args: string[]): Promise<SpecifyRunResult> {
    return this.exec(resolveSpecifyBin(workspacePath), workspacePath, args, TIMEOUT_MS);
  }

  // Install into the project's local venv when one exists; otherwise fall back
  // to a global `uv tool install`.
  installCli(workspacePath: string): Promise<SpecifyRunResult> {
    const uv = resolveUvBin(workspacePath);
    const venv = resolveVenvRoot(workspacePath);
    if (venv) {
      const python = path.join(venvBin(venv), PY_EXE);
      return this.exec(
        uv,
        workspacePath,
        ['pip', 'install', '--python', python, '--reinstall', `specify-cli @ ${SPEC_KIT_ZIP_URL}`],
        INSTALL_TIMEOUT_MS,
      );
    }
    return this.exec(
      uv,
      workspacePath,
      ['tool', 'install', 'specify-cli', '--from', SPEC_KIT_ZIP_URL, '--force'],
      INSTALL_TIMEOUT_MS,
    );
  }

  private exec(bin: string, cwd: string, args: string[], timeoutMs: number): Promise<SpecifyRunResult> {
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
        child = spawn(bin, args, { cwd, env: augmentedEnv(cwd) });
      } catch (err: any) {
        resolve({ code: 127, output: `Failed to start ${bin}: ${err.message}` });
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
        output += `\n${bin} error: ${err.message}`;
        finish(127);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        finish(code ?? 0);
      });
    });
  }
}
