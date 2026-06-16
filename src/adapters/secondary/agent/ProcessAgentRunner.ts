import { AgentRunnerPort } from '../../../domain/ports/out/AgentRunnerPort';
import { WorkflowPhase, AgentConfig } from '../../../domain/models/types';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PHASE_COMMANDS: Record<WorkflowPhase, string> = {
  constitution: '/speckit.constitution',
  specification: '/speckit.specify',
  clarification: '/speckit.clarify',
  planning: '/speckit.plan',
  checklist: '/speckit.checklist',
  analyze: '/speckit.analyze',
  tasks: '/speckit.tasks',
  taskstoissues: '/speckit.taskstoissues',
  implementation: '/speckit.implement',
};

export class ProcessAgentRunner implements AgentRunnerPort {
  async runPhase(
    workspacePath: string,
    phase: WorkflowPhase,
    featureName: string | null,
    agentConfig: AgentConfig,
    userPrompt?: string,
    onData?: (text: string) => void
  ): Promise<number> {
    const specArg = phase !== 'constitution' && featureName ? `specs/${featureName}` : null;
    const slashCmd = `${PHASE_COMMANDS[phase]}${specArg ? ` ${specArg}` : ''}`;
    
    const context = userPrompt?.trim();
    const fullPrompt = context ? `${context}\n\n${slashCmd}` : slashCmd;

    const { cmd, args, stdin } = this.buildSpawnArgs(agentConfig, fullPrompt);

    const isWin = process.platform === 'win32';

    return new Promise((resolve) => {
      onData?.(`Running: ${cmd} ${args.join(' ')}\n\n`);

      const child = isWin
        ? spawn(cmd, args, {
            cwd: workspacePath,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe']
          })
        : (() => {
            const shell = process.env.SHELL || '/bin/sh';
            const escapedArgs = [cmd, ...args].map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ');
            return spawn(shell, ['-l', '-c', escapedArgs], {
              cwd: workspacePath,
              stdio: ['pipe', 'pipe', 'pipe']
            });
          })();

      if (stdin !== undefined && child.stdin) {
        child.stdin.write(stdin);
        child.stdin.end();
      }

      child.stdout.on('data', (data) => {
        const text = data.toString();
        onData?.(text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        onData?.(text);
      });

      child.on('close', (code) => {
        const exitCode = code === null ? -1 : code;
        onData?.(`\nProcess exited with code ${exitCode}\n`);

        // Write the phase done file so local watch logs it
        try {
          const runtimeDir = path.join(workspacePath, '.specify', '.runtime');
          if (!fs.existsSync(runtimeDir)) {
            fs.mkdirSync(runtimeDir, { recursive: true });
          }
          fs.writeFileSync(
            path.join(runtimeDir, 'phase-done.txt'),
            `${phase}:${exitCode}`,
            'utf-8'
          );
        } catch {
          // ignore
        }

        resolve(exitCode);
      });

      child.on('error', (err) => {
        onData?.(`\nFailed to start process: ${err.message}\n`);
        resolve(-1);
      });
    });
  }

  private buildSpawnArgs(
    config: AgentConfig,
    prompt: string
  ): { cmd: string; args: string[]; stdin?: string } {
    const agentType = config.agentType;
    const cliPath = config.agentPath || this.getDefaultCli(agentType);

    switch (agentType) {
      case 'claude':
        return {
          cmd: cliPath,
          args: ['--permission-mode', 'bypassPermissions', prompt]
        };
      case 'gemini':
        return {
          cmd: cliPath,
          args: [],
          stdin: prompt
        };
      case 'copilot':
        return {
          cmd: cliPath,
          args: [prompt]
        };
      case 'openai':
        return {
          cmd: cliPath,
          args: ['exec', '-'],
          stdin: prompt
        };
      case 'custom':
        if (config.customCommand) {
          const parts = config.customCommand.split(' ');
          const cmd = parts[0];
          const args = parts.slice(1).map(arg => arg === '{{prompt}}' ? prompt : arg);
          // If {{prompt}} isn't in args, append it
          if (!config.customCommand.includes('{{prompt}}')) {
            args.push(prompt);
          }
          return { cmd, args };
        }
        return { cmd: 'specify', args: [prompt] };
      default:
        return { cmd: cliPath, args: [prompt] };
    }
  }

  private getDefaultCli(agentType: string): string {
    const defaults: Record<string, string> = {
      claude: 'claude',
      gemini: 'gemini',
      copilot: 'ghcs',
      openai: 'codex'
    };
    return defaults[agentType] || 'specify';
  }
}
