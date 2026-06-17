import * as fs from "fs";
import * as path from "path";
import type * as PtyModule from "node-pty";
import { spawn as cpSpawn, ChildProcess } from "child_process";

let cached: any = null;

class PureJsPtyLike {
  constructor(private child: ChildProcess) {}

  write(data: string) {
    this.child.stdin?.write(data);
  }

  resize(cols: number, rows: number) {
    // No-op for standard child_process pipes
  }

  kill(signal?: number | NodeJS.Signals) {
    this.child.kill(signal);
  }

  onData(cb: (data: string) => void) {
    this.child.stdout?.on("data", (chunk) => cb(chunk.toString()));
    this.child.stderr?.on("data", (chunk) => cb(chunk.toString()));
  }

  onExit(cb: (e: { exitCode: number; signal?: number }) => void) {
    this.child.on("exit", (code, signal) => {
      cb({ exitCode: code ?? 0, signal: signal ? 1 : undefined });
    });
  }
}

const pureJsPtyModule = {
  spawn(file: string, args: string[], options: any) {
    const cp = cpSpawn(file, args, {
      cwd: options.cwd,
      env: options.env,
    });
    return new PureJsPtyLike(cp);
  },
};

/**
 * Loads node-pty defensively.
 *
 * node-pty relies on a native `spawn-helper` binary (on POSIX) that must be
 * executable. Some package managers / extraction paths drop the exec bit when
 * unpacking the prebuilt binaries, which makes pty.spawn fail with
 * "posix_spawnp failed". We restore the exec bit before first use so the
 * workspace shell and interactive agent phases work regardless of how the
 * dependency was installed.
 */
export function loadPty(): any {
  if (cached) return cached;

  if (process.env.SPECKIT_TEST_FORCE_FALLBACK === "true") {
    cached = pureJsPtyModule;
    return pureJsPtyModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pty = require("node-pty") as typeof PtyModule;

    if (process.platform !== "win32") {
      try {
        const ptyDir = path.dirname(require.resolve("node-pty/package.json"));
        const prebuilds = path.join(ptyDir, "prebuilds");
        if (fs.existsSync(prebuilds)) {
          for (const entry of fs.readdirSync(prebuilds)) {
            const helper = path.join(prebuilds, entry, "spawn-helper");
            if (fs.existsSync(helper)) {
              try {
                fs.chmodSync(helper, 0o755);
              } catch {
                // best effort
              }
            }
          }
        }
      } catch {
        // best effort — if anything fails we still return the module
      }
    }

    cached = pty;
    return pty;
  } catch (err) {
    console.warn(
      "node-pty failed to load, falling back to pure child_process pty emulation.",
    );
    cached = pureJsPtyModule;
    return pureJsPtyModule;
  }
}

export function _clearPtyCacheForTesting() {
  cached = null;
}
