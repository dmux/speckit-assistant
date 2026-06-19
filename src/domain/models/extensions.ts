// An extension currently installed in the workspace (read from
// .specify/extensions/.registry + each extension.yml).
export type InstalledExtension = {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  source?: string;
  commandCount: number;
  hookCount: number;
  priority?: number;
  description?: string;
};

// An extension bundled with this app, installable via `specify extension add <dir> --dev`.
export type BundledExtension = {
  id: string;
  label: string;
  description: string;
  dir: string; // directory name under the app's extensions/ folder
};

export const BUNDLED_EXTENSIONS: BundledExtension[] = [
  {
    id: 'personas',
    label: 'Review Personas',
    description: 'Implementation review-gate sub-agents: QA, Code Review, Security, Tech Lead.',
    dir: 'spec-kit-personas',
  },
  {
    id: 'spec-agents',
    label: 'Specification Agents',
    description: 'Specification-phase agents: Product Owner, Architecture, Technical Refinement, Consolidate.',
    dir: 'spec-kit-spec-agents',
  },
];
