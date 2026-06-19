import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Resolve the app's own package root (where the bundled extensions/ live).
// The CLI sets SPECKIT_ASSISTANT_ROOT; in dev we fall back to cwd.
export function getAppRoot(): string {
  if (process.env.SPECKIT_ASSISTANT_ROOT) return process.env.SPECKIT_ASSISTANT_ROOT;
  if (fs.existsSync(path.join(process.cwd(), 'extensions', 'spec-kit-spec-agents'))) {
    return process.cwd();
  }
  return process.cwd();
}

// Absolute path to a bundled extension directory (e.g. 'spec-kit-spec-agents').
export function bundledExtensionDir(dir: string): string {
  return path.join(getAppRoot(), 'extensions', dir);
}

export function getWorkspacePath(): string {
  if (process.env.WORKSPACE_PATH) {
    return process.env.WORKSPACE_PATH;
  }
  try {
    const configPath = path.join(os.homedir(), '.speckit-assistant-config.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (data.lastWorkspacePath) {
        return data.lastWorkspacePath;
      }
    }
  } catch {
    // ignore
  }
  return process.cwd();
}
