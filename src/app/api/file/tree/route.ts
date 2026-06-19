import { NextResponse } from 'next/server';
import { getWorkspacePath } from '../../../../adapters/primary/api/utils';
import * as fs from 'fs';
import * as path from 'path';

// Directories that would bloat the tree or are not useful for review.
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'coverage',
  '.turbo',
  '.vercel',
]);

const MAX_ENTRIES = 5000;

type TreeNode = {
  name: string;
  path: string; // relative to the workspace root
  type: 'dir' | 'file';
  children?: TreeNode[];
};

function buildTree(absDir: string, relDir: string, counter: { n: number }): TreeNode[] {
  if (counter.n > MAX_ENTRIES) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs: TreeNode[] = [];
  const files: TreeNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') && EXCLUDED_DIRS.has(entry.name)) continue;
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    counter.n++;
    if (counter.n > MAX_ENTRIES) break;

    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      dirs.push({
        name: entry.name,
        path: relPath,
        type: 'dir',
        children: buildTree(path.join(absDir, entry.name), relPath, counter),
      });
    } else if (entry.isFile()) {
      files.push({ name: entry.name, path: relPath, type: 'file' });
    }
  }

  const byName = (a: TreeNode, b: TreeNode) => a.name.localeCompare(b.name);
  return [...dirs.sort(byName), ...files.sort(byName)];
}

export async function GET() {
  try {
    const workspacePath = getWorkspacePath();
    if (!fs.existsSync(workspacePath)) {
      return NextResponse.json({ tree: [], error: 'Workspace not found.' });
    }
    const tree = buildTree(workspacePath, '', { n: 0 });
    return NextResponse.json({ tree, root: path.basename(workspacePath) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
