#!/usr/bin/env node
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import open from 'open';
import * as os from 'os';
import { workflowService } from '../adapters/di';
import { WorkflowPhase, AgentConfig, AgentType } from '../domain/models/types';

const args = process.argv.slice(2);

// Resolve workspace path
function resolveWorkspace(cmdArgs: string[], projectDir: string): string {
  const flagIndex = cmdArgs.findIndex(arg => arg === '-w' || arg === '--workspace');
  if (flagIndex !== -1 && cmdArgs[flagIndex + 1]) {
    const resolved = path.resolve(cmdArgs[flagIndex + 1]);
    saveWorkspacePath(projectDir, resolved);
    return resolved;
  }
  for (let i = 0; i < cmdArgs.length; i++) {
    const arg = cmdArgs[i];
    if (!arg.startsWith('-')) {
      const prev = cmdArgs[i - 1];
      if (prev !== '-p' && prev !== '--port' && prev !== '-w' && prev !== '--workspace' && prev !== '--agent' && prev !== '--prompt') {
        if (fs.existsSync(arg) && fs.statSync(arg).isDirectory()) {
          const resolved = path.resolve(arg);
          saveWorkspacePath(projectDir, resolved);
          return resolved;
        }
      }
    }
  }
  
  const saved = loadWorkspacePath(projectDir);
  if (saved) {
    return saved;
  }

  const fallback = process.cwd();
  saveWorkspacePath(projectDir, fallback);
  return fallback;
}

function loadWorkspacePath(projectDir: string): string | null {
  try {
    const configPath = path.join(os.homedir(), '.speckit-assistant-config.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return data.lastWorkspacePath || null;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveWorkspacePath(projectDir: string, resolvedPath: string) {
  try {
    const configPath = path.join(os.homedir(), '.speckit-assistant-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ lastWorkspacePath: resolvedPath }, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

const appDir = path.resolve(__dirname, '../..');
const workspacePath = resolveWorkspace(args, appDir);
process.env.WORKSPACE_PATH = workspacePath;

const subcommands = ['status', 'approve', 'discard', 'run', 'create', 'delete'];
const firstArg = args[0];

// Help menu
function showHelp() {
  console.log(`
🌱 Spec Kit Assistant CLI

Usage:
  speckit-assistant                   Start the Web UI server
  speckit-assistant status            Show current SDD workflow status
  speckit-assistant approve <phase> [feature]   Approve a phase
  speckit-assistant discard <phase> [feature]   Reset/discard a phase
  speckit-assistant create <feature>  Create a new feature folder
  speckit-assistant delete <feature>  Delete a feature folder
  speckit-assistant run <phase> [feature] [--agent <type>] [--prompt <text>]  Run an agent phase

Options:
  -w, --workspace <path>              Specify target workspace path (default: current directory)
  -p, --port <number>                 Specify Web UI server port (default: 18080)
  --agent <claude|gemini|copilot>     AI agent to use for run command (default: claude)
  --prompt <text>                     User refinements or prompt additions for the run
  --help                              Show this help menu
`);
}

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

// 1. Run Subcommands
if (firstArg && subcommands.includes(firstArg)) {
  handleSubcommand(firstArg, args.slice(1));
} else {
  // 2. Start Web Server
  startWebServer();
}

// --- Web Server Launcher ---
function startWebServer() {
  const portFlagIndex = args.findIndex(arg => arg === '-p' || arg === '--port');
  const port = portFlagIndex !== -1 && args[portFlagIndex + 1] ? args[portFlagIndex + 1] : '18080';

  console.log(`\n🌱 Spec Kit Assistant Web Server`);
  console.log(`📂 Workspace: ${workspacePath}`);
  console.log(`🔌 Starting server on port ${port}...\n`);

  // Server files are compiled in the same parent directory
  const appDir = path.resolve(__dirname, '../..');
  let nextBin = '';
  try {
    const nextPkg = require.resolve('next/package.json', { paths: [appDir] });
    nextBin = path.join(path.dirname(nextPkg), 'dist', 'bin', 'next');
  } catch (err) {
    nextBin = path.join(appDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  }

  if (!fs.existsSync(nextBin)) {
    console.error(`Error: next binary not found at ${nextBin}`);
    console.error(`Please make sure next is installed.`);
    process.exit(1);
  }

  const child = spawn(process.execPath, [nextBin, 'start', '-p', port], {
    cwd: appDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      WORKSPACE_PATH: workspacePath
    }
  });

  setTimeout(() => {
    const url = `http://localhost:${port}`;
    console.log(`\n🚀 Speckit Assistant available at: ${url}`);
    open(url).catch(() => {});
  }, 2500);

  child.on('exit', (code) => {
    process.exit(code || 0);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
    process.exit(0);
  });
}

// --- CLI Subcommand Handlers ---
async function handleSubcommand(command: string, cmdArgs: string[]) {
  try {
    switch (command) {
      case 'status':
        await printStatus();
        break;
      case 'approve':
        await approvePhase(cmdArgs);
        break;
      case 'discard':
        await discardPhase(cmdArgs);
        break;
      case 'create':
        await createFeature(cmdArgs);
        break;
      case 'delete':
        await deleteFeature(cmdArgs);
        break;
      case 'run':
        await runPhase(cmdArgs);
        break;
    }
    process.exit(0);
  } catch (err: any) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

async function printStatus() {
  const state = await workflowService.getWorkflowState(workspacePath);
  console.log(`\n🌱 SDD WORKFLOW STATUS`);
  console.log(`📂 Workspace: ${workspacePath}`);
  console.log(`----------------------------------------------------------------------`);
  
  // Constitution status
  console.log(`📜 Constitution: [${state.constitutionPhase.status.toUpperCase()}] ${state.constitutionPhase.stale ? '(STALE)' : ''}`);
  console.log(`   File: ${state.constitutionPhase.filePath || 'Not created'}`);
  console.log(`----------------------------------------------------------------------`);

  // Features status
  if (state.features.length === 0) {
    console.log(`(No features found in specs/ directory)`);
    return;
  }

  state.features.forEach(feat => {
    console.log(`\n🔹 Feature: "${feat.name}"`);
    feat.phases.forEach(p => {
      let progressStr = '';
      if (p.phase === 'tasks' && p.content) {
        const checkboxes = [...p.content.matchAll(/^\s*(?:[-*]|\d+\.)\s+\[( |x|X)\]/gm)];
        if (checkboxes.length > 0) {
          const done = checkboxes.filter(c => c[1].toLowerCase() === 'x').length;
          progressStr = ` (${done}/${checkboxes.length} tasks)`;
        }
      }
      const statusLabel = p.status.toUpperCase();
      const staleLabel = p.stale ? ' (STALE)' : '';
      console.log(`   - [${p.phase.padEnd(14)}]: ${statusLabel}${staleLabel}${progressStr}`);
    });
  });
  console.log();
}

async function approvePhase(cmdArgs: string[]) {
  const phase = cmdArgs[0] as WorkflowPhase;
  if (!phase) throw new Error('Missing phase argument. Usage: approve <phase> [feature]');
  
  let feature: string | null = null;
  if (phase !== 'constitution') {
    feature = cmdArgs[1] || null;
    if (!feature) {
      const state = await workflowService.getWorkflowState(workspacePath);
      feature = state.activeFeatureName;
      if (!feature) throw new Error('No active feature. Please specify feature name.');
    }
  }

  console.log(`Approving phase "${phase}"${feature ? ` for feature "${feature}"` : ''}...`);
  await workflowService.approvePhase(workspacePath, phase, feature);
  console.log('✅ Approved successfully!');
}

async function discardPhase(cmdArgs: string[]) {
  const phase = cmdArgs[0] as WorkflowPhase;
  if (!phase) throw new Error('Missing phase argument. Usage: discard <phase> [feature]');

  let feature: string | null = null;
  if (phase !== 'constitution') {
    feature = cmdArgs[1] || null;
    if (!feature) {
      const state = await workflowService.getWorkflowState(workspacePath);
      feature = state.activeFeatureName;
      if (!feature) throw new Error('No active feature. Please specify feature name.');
    }
  }

  console.log(`Discarding/resetting phase "${phase}"${feature ? ` for feature "${feature}"` : ''}...`);
  await workflowService.discardPhase(workspacePath, phase, feature);
  console.log('✅ Discarded/reset successfully!');
}

async function createFeature(cmdArgs: string[]) {
  const name = cmdArgs[0];
  if (!name) throw new Error('Missing feature name. Usage: create <feature-name>');

  console.log(`Creating feature "${name}"...`);
  await workflowService.createFeature(workspacePath, name);
  console.log('✅ Feature folder created!');
}

async function deleteFeature(cmdArgs: string[]) {
  const name = cmdArgs[0];
  if (!name) throw new Error('Missing feature name. Usage: delete <feature-name>');

  console.log(`Deleting feature "${name}"...`);
  await workflowService.deleteFeature(workspacePath, name);
  console.log('✅ Feature folder deleted!');
}

async function runPhase(cmdArgs: string[]) {
  const phase = cmdArgs[0] as WorkflowPhase;
  if (!phase) throw new Error('Missing phase argument. Usage: run <phase> [feature] [options]');

  let feature: string | null = null;
  let nextArgIndex = 1;
  
  if (phase !== 'constitution') {
    if (cmdArgs[1] && !cmdArgs[1].startsWith('--')) {
      feature = cmdArgs[1];
      nextArgIndex = 2;
    } else {
      const state = await workflowService.getWorkflowState(workspacePath);
      feature = state.activeFeatureName;
      if (!feature) throw new Error('No active feature. Please specify feature name.');
    }
  }

  // Parse options
  const optArgs = cmdArgs.slice(nextArgIndex);
  const agentFlagIndex = optArgs.findIndex(arg => arg === '--agent');
  const agentType = agentFlagIndex !== -1 && optArgs[agentFlagIndex + 1] ? optArgs[agentFlagIndex + 1] as AgentType : 'claude';
  
  const promptFlagIndex = optArgs.findIndex(arg => arg === '--prompt');
  const promptText = promptFlagIndex !== -1 && optArgs[promptFlagIndex + 1] ? optArgs[promptFlagIndex + 1] : undefined;

  const agentConfig: AgentConfig = { agentType };

  console.log(`Running phase "${phase}"${feature ? ` for feature "${feature}"` : ''} using agent "${agentType}"...\n`);

  await workflowService.runPhase(
    workspacePath,
    phase,
    feature,
    agentConfig,
    promptText,
    (logData) => {
      process.stdout.write(logData);
    }
  );
  
  console.log('\n🏁 Phase run completed!');
}
