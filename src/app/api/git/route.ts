import { NextResponse } from 'next/server';
import { getWorkspacePath } from '../../../adapters/primary/api/utils';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function runGit(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function getRefBranch(cwd: string): string {
  const output = runGit('git branch --format="%(refname:short)"', cwd);
  const branches = output.split('\n').map(b => b.trim());
  if (branches.includes('main')) return 'main';
  if (branches.includes('master')) return 'master';
  return 'HEAD';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const filePath = searchParams.get('file');

    const workspacePath = getWorkspacePath();

    // Check if git is initialized
    if (!fs.existsSync(path.join(workspacePath, '.git'))) {
      return NextResponse.json({ 
        files: [], 
        log: [], 
        error: 'Git repository not found in workspace.' 
      });
    }

    const ref = getRefBranch(workspacePath);

    if (action === 'diff' && filePath) {
      const absPath = path.resolve(workspacePath, filePath);
      
      // Safety check: ensure file is inside workspace
      const normWorkspace = path.normalize(workspacePath).replace(/\\/g, '/').toLowerCase();
      const normFile = path.normalize(absPath).replace(/\\/g, '/').toLowerCase();
      if (!normFile.startsWith(normWorkspace)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Check if file is untracked
      const statusOutput = runGit(`git status --porcelain "${filePath}"`, workspacePath);
      const isUntracked = statusOutput.startsWith('??');

      if (isUntracked && fs.existsSync(absPath)) {
        // Return file contents prefixed with + to simulate unified diff for new file
        const content = fs.readFileSync(absPath, 'utf-8');
        const diffLines = content.split('\n').map(line => `+${line}`).join('\n');
        return NextResponse.json({ diff: diffLines });
      }

      const diffOutput = runGit(`git diff ${ref} -- "${filePath}"`, workspacePath);
      return NextResponse.json({ diff: diffOutput || 'No modifications found.' });
    }

    if (action === 'status') {
      // 1. Get modified files with stats
      const numstatOutput = runGit(`git diff ${ref} --numstat`, workspacePath);
      const filesMap: Record<string, { path: string; additions: number; deletions: number; type: string }> = {};

      if (numstatOutput) {
        numstatOutput.split('\n').forEach(line => {
          const parts = line.split('\t');
          if (parts.length >= 3) {
            const additions = parseInt(parts[0], 10) || 0;
            const deletions = parseInt(parts[1], 10) || 0;
            const relPath = parts[2].trim();
            const ext = path.extname(relPath).toLowerCase();
            const isTest = relPath.endsWith('.test.ts') || relPath.endsWith('.test.js') || relPath.endsWith('.spec.ts') || relPath.endsWith('.spec.js');
            const type = isTest ? 'test' 
                       : (ext === '.ts' || ext === '.js' || ext === '.tsx' || ext === '.jsx' ? 'code' : 'doc');
            filesMap[relPath] = { path: relPath, additions, deletions, type };
          }
        });
      }

      // 2. Get untracked files and append them
      const statusOutput = runGit('git status --porcelain', workspacePath);
      if (statusOutput) {
        statusOutput.split('\n').forEach(line => {
          if (line.startsWith('??')) {
            const relPath = line.substring(3).trim();
            if (!filesMap[relPath]) {
              // Estimate lines as additions
              let additions = 0;
              const absPath = path.join(workspacePath, relPath);
              try {
                if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
                  additions = fs.readFileSync(absPath, 'utf-8').split('\n').length;
                }
              } catch {
                // ignore
              }
              const ext = path.extname(relPath).toLowerCase();
              const isTest = relPath.endsWith('.test.ts') || relPath.endsWith('.test.js') || relPath.endsWith('.spec.ts') || relPath.endsWith('.spec.js');
              const type = isTest ? 'test' 
                         : (ext === '.ts' || ext === '.js' || ext === '.tsx' || ext === '.jsx' ? 'code' : 'doc');
              filesMap[relPath] = { path: relPath, additions, deletions: 0, type };
            }
          }
        });
      }

      const files = Object.values(filesMap);

      // 3. Get Git Log
      const logOutput = runGit('git log -n 10 --pretty=format:"%h|%s|%an|%ar"', workspacePath);
      const log = logOutput ? logOutput.split('\n').map(line => {
        const [hash, message, author, date] = line.split('|');
        return { hash, message, author, date };
      }) : [];

      // 4. Get active branch name
      const branch = runGit('git rev-parse --abbrev-ref HEAD', workspacePath) || 'HEAD';

      return NextResponse.json({ files, log, branch });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
