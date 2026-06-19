// Pure builder that maps an extension management action to the `specify` argv
// (everything after the binary name). Kept side-effect free for testability.

export type SpecifyActionInput =
  | { action: 'install-bundled'; path: string; priority?: number }
  | { action: 'install-community'; id: string; fromUrl?: string; priority?: number }
  | { action: 'install-catalog'; id: string; priority?: number }
  | { action: 'remove'; id: string }
  | { action: 'enable'; id: string }
  | { action: 'disable'; id: string }
  | { action: 'set-priority'; id: string; priority: number };

function priorityArgs(priority?: number): string[] {
  return typeof priority === 'number' ? ['--priority', String(priority)] : [];
}

// Allow HTTPS, plus HTTP only for localhost (mirrors the spec-kit CLI rule).
function assertSafeUrl(url: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && isLocalhost)) {
    throw new Error('URL must use HTTPS (HTTP allowed only for localhost).');
  }
}

export function buildSpecifyArgs(input: SpecifyActionInput): string[] {
  switch (input.action) {
    case 'install-bundled':
      return ['extension', 'add', input.path, '--dev', '--force', ...priorityArgs(input.priority)];
    case 'install-community': {
      const fromArgs = input.fromUrl ? (assertSafeUrl(input.fromUrl), ['--from', input.fromUrl]) : [];
      return ['extension', 'add', input.id, ...fromArgs, ...priorityArgs(input.priority)];
    }
    case 'install-catalog':
      return ['extension', 'add', input.id, ...priorityArgs(input.priority)];
    case 'remove':
      return ['extension', 'remove', input.id, '--force'];
    case 'enable':
      return ['extension', 'enable', input.id];
    case 'disable':
      return ['extension', 'disable', input.id];
    case 'set-priority':
      return ['extension', 'set-priority', input.id, String(input.priority)];
    default: {
      const _exhaustive: never = input;
      throw new Error(`Unknown action: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
