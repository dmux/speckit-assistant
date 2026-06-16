import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
