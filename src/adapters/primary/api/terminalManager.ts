import type * as pty from "node-pty";
import { loadPty } from "../../secondary/pty/ptyLoader";
import { getWorkspacePath } from "./utils";

class TerminalManager {
  private activeProcess: pty.IPty | null = null;
  private listeners: Set<(data: string) => void> = new Set();
  private workspacePath: string = "";

  private getOrSpawnProcess(): pty.IPty {
    const currentWorkspace = getWorkspacePath();

    // Spawn a new shell if none exists or if the workspace directory changed
    if (!this.activeProcess || this.workspacePath !== currentWorkspace) {
      if (this.activeProcess) {
        this.cleanup();
      }

      this.workspacePath = currentWorkspace;
      const isWin = process.platform === "win32";
      const shell = isWin ? "cmd.exe" : process.env.SHELL || "/bin/bash";

      // Login shell flag. The PTY itself provides the TTY that makes the shell
      // behave interactively (prompt rendering, line editing, job control), so
      // no explicit `-i` is needed.
      const args = isWin ? [] : ["-l"];

      const spawned = loadPty().spawn(shell, args, {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: this.workspacePath,
        env: {
          ...process.env,
          TERM: "xterm-256color",
        } as { [key: string]: string },
      });
      this.activeProcess = spawned;

      spawned.onData((data: string) => {
        this.broadcast(data);
      });

      spawned.onExit(() => {
        this.broadcast("\r\n[Shell process exited]\r\n");
        this.activeProcess = null;
      });
    }

    if (!this.activeProcess) {
      throw new Error("Failed to initialize terminal process");
    }

    return this.activeProcess;
  }

  private broadcast(data: string) {
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch {
        // ignore dead connections
      }
    });
  }

  public addListener(listener: (data: string) => void) {
    this.listeners.add(listener);
    // Trigger terminal instantiation process
    this.getOrSpawnProcess();
  }

  public removeListener(listener: (data: string) => void) {
    this.listeners.delete(listener);
    // If no terminal pages are listening, we keep the process alive
    // so command state is persisted (like a real terminal multiplexer)
  }

  public writeInput(text: string): boolean {
    const proc = this.getOrSpawnProcess();
    proc.write(text);
    return true;
  }

  public resize(cols: number, rows: number): boolean {
    if (!this.activeProcess) return false;
    try {
      this.activeProcess.resize(cols, rows);
      return true;
    } catch {
      return false;
    }
  }

  public cleanup() {
    if (this.activeProcess) {
      this.activeProcess.kill();
      this.activeProcess = null;
    }
    this.listeners.clear();
  }
}

export const terminalManager = new TerminalManager();
