import { spawn, ChildProcess } from 'child_process';
import { getWorkspacePath } from './utils';

class TerminalManager {
  private activeProcess: ChildProcess | null = null;
  private listeners: Set<(data: string) => void> = new Set();
  private workspacePath: string = '';

  private getOrSpawnProcess(): ChildProcess {
    const currentWorkspace = getWorkspacePath();

    // Spawn a new shell if none exists or if the workspace directory changed
    if (!this.activeProcess || this.workspacePath !== currentWorkspace) {
      if (this.activeProcess) {
        this.cleanup();
      }

      this.workspacePath = currentWorkspace;
      const isWin = process.platform === 'win32';
      const shell = isWin ? 'cmd.exe' : (process.env.SHELL || '/bin/bash');

      // Use login shell flags if appropriate
      const args = isWin ? [] : ['-l'];

      this.activeProcess = spawn(shell, args, {
        cwd: this.workspacePath,
        env: {
          ...process.env,
          TERM: 'xterm-256color', // Tells the shell to produce ANSI color codes
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.activeProcess.stdout?.on('data', (chunk) => {
        const str = chunk.toString();
        this.broadcast(str);
      });

      this.activeProcess.stderr?.on('data', (chunk) => {
        const str = chunk.toString();
        this.broadcast(str);
      });

      this.activeProcess.on('close', () => {
        this.broadcast('\r\n[Shell process exited]\r\n');
        this.activeProcess = null;
      });

      this.activeProcess.on('error', (err) => {
        this.broadcast(`\r\n[Failed to start shell process: ${err.message}]\r\n`);
        this.activeProcess = null;
      });
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
    const process = this.getOrSpawnProcess();
    if (process.stdin && process.stdin.writable) {
      process.stdin.write(text);
      return true;
    }
    return false;
  }

  public cleanup() {
    if (this.activeProcess) {
      this.activeProcess.kill('SIGKILL');
      this.activeProcess = null;
    }
    this.listeners.clear();
  }
}

export const terminalManager = new TerminalManager();
