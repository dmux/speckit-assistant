import { AgentRunnerPort } from "../../../domain/ports/out/AgentRunnerPort";
import {
  WorkflowPhase,
  AgentConfig,
  PersonaConfig,
  PersonaId,
} from "../../../domain/models/types";
import type * as pty from "node-pty";
import { loadPty } from "../pty/ptyLoader";
import * as fs from "fs";
import * as path from "path";

const PHASE_COMMANDS: Record<WorkflowPhase, string> = {
  constitution: "/speckit.constitution",
  specification: "/speckit.specify",
  clarification: "/speckit.clarify",
  planning: "/speckit.plan",
  checklist: "/speckit.checklist",
  analyze: "/speckit.analyze",
  tasks: "/speckit.tasks",
  taskstoissues: "/speckit.taskstoissues",
  implementation: "/speckit.implement",
};

export class ProcessAgentRunner implements AgentRunnerPort {
  private activeProcesses = new Map<string, pty.IPty>();

  private phaseKey(featureName: string | null, phase: WorkflowPhase): string {
    return `${featureName || "global"}-${phase}`;
  }

  private personaKey(featureName: string, id: PersonaId): string {
    return `${featureName}-impl-persona-${id}`;
  }

  async writeStdin(
    phase: WorkflowPhase,
    featureName: string | null,
    text: string,
    personaId?: PersonaId,
  ): Promise<boolean> {
    const procKey =
      personaId && featureName
        ? this.personaKey(featureName, personaId)
        : this.phaseKey(featureName, phase);
    const child = this.activeProcesses.get(procKey);
    if (child) {
      // The frontend xterm sends raw keystrokes (arrow keys, Enter as '\r', etc.)
      // so we forward them verbatim — this is what lets interactive pickers like
      // the clarify Q&A be navigated, not just line-based answers.
      child.write(text);
      return true;
    }
    return false;
  }

  async resize(
    phase: WorkflowPhase,
    featureName: string | null,
    cols: number,
    rows: number,
    personaId?: PersonaId,
  ): Promise<boolean> {
    const procKey =
      personaId && featureName
        ? this.personaKey(featureName, personaId)
        : this.phaseKey(featureName, phase);
    const child = this.activeProcesses.get(procKey);
    if (!child) return false;
    try {
      child.resize(cols, rows);
      return true;
    } catch {
      return false;
    }
  }

  async stop(
    phase: WorkflowPhase,
    featureName: string | null,
    personaId?: PersonaId,
  ): Promise<boolean> {
    const procKey =
      personaId && featureName
        ? this.personaKey(featureName, personaId)
        : this.phaseKey(featureName, phase);
    const child = this.activeProcesses.get(procKey);
    if (child) {
      try {
        child.kill();
        this.activeProcesses.delete(procKey);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  async runPhase(
    workspacePath: string,
    phase: WorkflowPhase,
    featureName: string | null,
    agentConfig: AgentConfig,
    userPrompt?: string,
    onData?: (text: string) => void,
  ): Promise<number> {
    const specArg =
      phase !== "constitution" && featureName ? `specs/${featureName}` : null;
    const slashCmd = `${PHASE_COMMANDS[phase]}${specArg ? ` ${specArg}` : ""}`;

    const context = userPrompt?.trim();
    const fullPrompt = context ? `${context}\n\n${slashCmd}` : slashCmd;

    return this.spawnAgent({
      workspacePath,
      procKey: this.phaseKey(featureName, phase),
      doneTag: phase,
      agentConfig,
      fullPrompt,
      onData,
    });
  }

  async runPersona(
    workspacePath: string,
    featureName: string,
    persona: PersonaConfig,
    agentConfig: AgentConfig,
    onData?: (text: string) => void,
  ): Promise<number> {
    // Personas always operate on a specific feature's artifacts.
    const fullPrompt = `${persona.command} specs/${featureName}`;

    return this.spawnAgent({
      workspacePath,
      procKey: this.personaKey(featureName, persona.id),
      doneTag: `persona:${persona.id}`,
      agentConfig,
      fullPrompt,
      onData,
      persona,
    });
  }

  // Shared spawn path for both phase and persona runs: spawns the agent CLI
  // under a PTY (so interactive CLIs detect a TTY), streams output, and resolves
  // with the exit code.
  private spawnAgent(opts: {
    workspacePath: string;
    procKey: string;
    doneTag: string;
    agentConfig: AgentConfig;
    fullPrompt: string;
    onData?: (text: string) => void;
    persona?: PersonaConfig;
  }): Promise<number> {
    const { workspacePath, procKey, doneTag, agentConfig, fullPrompt, onData } =
      opts;
    const { cmd, args, stdin } = this.buildSpawnArgs(agentConfig, fullPrompt);

    return new Promise((resolve) => {
      onData?.(`Running: ${cmd} ${args.join(" ")}\n\n`);

      // Spawn the agent under a real pseudo-terminal. This is what makes
      // interactive CLIs (e.g. the clarify Q&A) detect a TTY via isatty() and
      // actually prompt the user instead of running single-shot. We still go
      // through a login shell so PATH/aliases resolve the agent binary the same
      // way they would in the user's own terminal.
      const isWin = process.platform === "win32";
      const ptyFile = isWin
        ? process.env.COMSPEC || "cmd.exe"
        : process.env.SHELL || "/bin/bash";
      const ptyArgs = isWin
        ? ["/c", [cmd, ...args].join(" ")]
        : [
            "-l",
            "-c",
            [cmd, ...args]
              .map((a) => `'${a.replace(/'/g, "'\\''")}'`)
              .join(" "),
          ];

      const child = loadPty().spawn(ptyFile, ptyArgs, {
        name: "xterm-256color",
        cols: 120,
        rows: 30,
        cwd: workspacePath,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          ...(opts.persona
            ? {
                SPECKIT_PERSONA_ID: opts.persona.id || "",
                SPECKIT_PERSONA_LABEL: opts.persona.label || "",
                SPECKIT_PERSONA_MODEL: opts.persona.model || "",
                SPECKIT_PERSONA_SYSTEM_PROMPT: opts.persona.systemPrompt || "",
                SPECKIT_PERSONA_CAPABILITIES: Array.isArray(
                  opts.persona.capabilities,
                )
                  ? opts.persona.capabilities.join(",")
                  : "",
                SPECKIT_PERSONA_TOOLS: Array.isArray(opts.persona.tools)
                  ? opts.persona.tools.join(",")
                  : "",
              }
            : {}),
        } as { [key: string]: string },
      });

      this.activeProcesses.set(procKey, child);

      // For agents that receive their prompt over stdin, feed it now and send
      // EOF (Ctrl-D) so the single-shot CLI starts processing. Agents that take
      // the prompt as an argument keep the channel open so the user can answer
      // interactive prompts (e.g. clarify) through writeStdin().
      if (stdin !== undefined) {
        child.write(stdin);
        child.write("\x04");
      }

      child.onData((data: string) => {
        onData?.(data);
      });

      child.onExit(({ exitCode }: { exitCode: number }) => {
        this.activeProcesses.delete(procKey);
        onData?.(`\nProcess exited with code ${exitCode}\n`);

        // Write the phase done file so local watch logs it
        try {
          const runtimeDir = path.join(workspacePath, ".specify", ".runtime");
          if (!fs.existsSync(runtimeDir)) {
            fs.mkdirSync(runtimeDir, { recursive: true });
          }
          fs.writeFileSync(
            path.join(runtimeDir, "phase-done.txt"),
            `${doneTag}:${exitCode}`,
            "utf-8",
          );
        } catch {
          // ignore
        }

        resolve(exitCode);
      });
    });
  }

  private buildSpawnArgs(
    config: AgentConfig,
    prompt: string,
  ): { cmd: string; args: string[]; stdin?: string } {
    const agentType = config.agentType;
    const cliPath = config.agentPath || this.getDefaultCli(agentType);

    switch (agentType) {
      case "claude":
        return {
          cmd: cliPath,
          args: ["--permission-mode", "bypassPermissions", prompt],
        };
      case "gemini":
        return {
          cmd: cliPath,
          args: [],
          stdin: prompt,
        };
      case "copilot":
        return {
          cmd: cliPath,
          args: [prompt],
        };
      case "openai":
        return {
          cmd: cliPath,
          args: ["exec", "-"],
          stdin: prompt,
        };
      case "custom":
        if (config.customCommand) {
          const parts = config.customCommand.split(" ");
          const cmd = parts[0];
          const args = parts
            .slice(1)
            .map((arg) => (arg === "{{prompt}}" ? prompt : arg));
          // If {{prompt}} isn't in args, append it
          if (!config.customCommand.includes("{{prompt}}")) {
            args.push(prompt);
          }
          return { cmd, args };
        }
        return { cmd: "specify", args: [prompt] };
      default:
        return { cmd: cliPath, args: [prompt] };
    }
  }

  private getDefaultCli(agentType: string): string {
    const defaults: Record<string, string> = {
      claude: "claude",
      gemini: "gemini",
      copilot: "ghcs",
      openai: "codex",
    };
    return defaults[agentType] || "specify";
  }
}
