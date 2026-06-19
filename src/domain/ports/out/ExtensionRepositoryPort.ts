import { InstalledExtension } from '../../models/extensions';

export interface ExtensionRepositoryPort {
  // Reads installed extensions from .specify/extensions/.registry (+ each extension.yml).
  listInstalled(workspacePath: string): Promise<InstalledExtension[]>;
}
