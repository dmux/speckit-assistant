import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Mock child_process
vi.mock('child_process', () => {
  return {
    execSync: vi.fn(),
  };
});

// Mock fs
vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal<typeof fs>();
  return {
    ...original,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    statSync: vi.fn(),
  };
});

describe('Git API Route', () => {
  const mockWorkspace = '/mock/workspace';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WORKSPACE_PATH = mockWorkspace;
  });

  afterEach(() => {
    delete process.env.WORKSPACE_PATH;
  });

  it('should return error if .git folder is not found', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('.git')) {
        return false;
      }
      return true;
    });

    const req = new Request('http://localhost/api/git?action=status');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.error).toBe('Git repository not found in workspace.');
    expect(data.files).toEqual([]);
    expect(data.log).toEqual([]);
  });

  it('should return 400 for invalid action', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const req = new Request('http://localhost/api/git?action=invalid');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid action');
  });

  it('should return 500 when an exception is thrown', async () => {
    vi.mocked(fs.existsSync).mockImplementation(() => {
      throw new Error('Disk crash');
    });

    const req = new Request('http://localhost/api/git?action=status');
    const res = await GET(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Disk crash');
  });

  describe('action=status', () => {
    it('returns files, log and branch successfully (resolving ref to main)', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      vi.mocked(execSync).mockImplementation((cmd) => {
        const command = cmd.toString();
        if (command.includes('git branch --format')) {
          return 'feature-branch\nmain\nmaster';
        }
        if (command.includes('git diff main --numstat')) {
          return '10\t5\tsrc/index.ts\n2\t0\tsrc/index.test.ts\n5\t2\tREADME.md';
        }
        if (command.includes('git status --porcelain')) {
          return '?? src/untracked.ts\n?? src/untracked-no-exist.ts';
        }
        if (command.includes('git log')) {
          return 'abc1234|commit message|Author Name|2 hours ago';
        }
        if (command.includes('git rev-parse --abbrev-ref HEAD')) {
          return 'feature-branch';
        }
        return '';
      });

      vi.mocked(fs.statSync).mockImplementation(() => {
        return { isFile: () => true } as any;
      });

      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('untracked.ts')) {
          return 'console.log("hello");\nconsole.log("world");';
        }
        throw new Error('File not found');
      });

      const req = new Request('http://localhost/api/git?action=status');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      
      expect(data.branch).toBe('feature-branch');
      expect(data.files).toHaveLength(5);
      
      const indexFile = data.files.find((f: any) => f.path === 'src/index.ts');
      expect(indexFile).toEqual({ path: 'src/index.ts', additions: 10, deletions: 5, type: 'code' });

      const testFile = data.files.find((f: any) => f.path === 'src/index.test.ts');
      expect(testFile).toEqual({ path: 'src/index.test.ts', additions: 2, deletions: 0, type: 'test' });

      const readmeFile = data.files.find((f: any) => f.path === 'README.md');
      expect(readmeFile).toEqual({ path: 'README.md', additions: 5, deletions: 2, type: 'doc' });

      const untrackedFile = data.files.find((f: any) => f.path === 'src/untracked.ts');
      expect(untrackedFile).toEqual({ path: 'src/untracked.ts', additions: 2, deletions: 0, type: 'code' });

      const untrackedNoExistFile = data.files.find((f: any) => f.path === 'src/untracked-no-exist.ts');
      expect(untrackedNoExistFile).toEqual({ path: 'src/untracked-no-exist.ts', additions: 0, deletions: 0, type: 'code' });

      expect(data.log).toEqual([
        { hash: 'abc1234', message: 'commit message', author: 'Author Name', date: '2 hours ago' }
      ]);
    });

    it('resolves ref to master if main is absent', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementation((cmd) => {
        const command = cmd.toString();
        if (command.includes('git branch --format')) {
          return 'feature-branch\nmaster';
        }
        if (command.includes('git diff master --numstat')) {
          return '1\t1\tsrc/main.ts';
        }
        return '';
      });

      const req = new Request('http://localhost/api/git?action=status');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.files).toHaveLength(1);
    });

    it('resolves ref to HEAD if both main and master are absent', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementation((cmd) => {
        const command = cmd.toString();
        if (command.includes('git branch --format')) {
          return 'feature-branch';
        }
        if (command.includes('git diff HEAD --numstat')) {
          return '1\t1\tsrc/main.ts';
        }
        return '';
      });

      const req = new Request('http://localhost/api/git?action=status');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.files).toHaveLength(1);
    });
  });

  describe('action=diff', () => {
    it('returns 403 access denied if file path is outside the workspace', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const req = new Request('http://localhost/api/git?action=diff&file=../../etc/passwd');
      const res = await GET(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Access denied');
    });

    it('returns unified diff for tracked file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementation((cmd) => {
        const command = cmd.toString();
        if (command.includes('git branch --format')) {
          return 'main';
        }
        if (command.includes('git status --porcelain')) {
          return ' M src/index.ts';
        }
        if (command.includes('git diff main -- "src/index.ts"')) {
          return 'diff --git a/src/index.ts b/src/index.ts\n+added line\n-removed line';
        }
        return '';
      });

      const req = new Request('http://localhost/api/git?action=diff&file=src/index.ts');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.diff).toBe('diff --git a/src/index.ts b/src/index.ts\n+added line\n-removed line');
    });

    it('returns simulated diff for untracked file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementation((cmd) => {
        const command = cmd.toString();
        if (command.includes('git status --porcelain')) {
          return '?? src/newfile.ts';
        }
        return '';
      });

      vi.mocked(fs.readFileSync).mockReturnValue('new line 1\nnew line 2');

      const req = new Request('http://localhost/api/git?action=diff&file=src/newfile.ts');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.diff).toBe('+new line 1\n+new line 2');
    });

    it('returns default fallback message if git diff output is empty', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue('');

      const req = new Request('http://localhost/api/git?action=diff&file=src/unchanged.ts');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.diff).toBe('No modifications found.');
    });
  });
});
