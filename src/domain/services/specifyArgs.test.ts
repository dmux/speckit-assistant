import { describe, it, expect } from 'vitest';
import { buildSpecifyArgs } from './specifyArgs';

describe('buildSpecifyArgs', () => {
  it('install-bundled uses --dev --force on the local path', () => {
    expect(buildSpecifyArgs({ action: 'install-bundled', path: '/app/extensions/spec-kit-spec-agents' }))
      .toEqual(['extension', 'add', '/app/extensions/spec-kit-spec-agents', '--dev', '--force']);
  });

  it('install-community passes --from and --priority', () => {
    expect(buildSpecifyArgs({ action: 'install-community', id: 'spec-kit-onboard', fromUrl: 'https://github.com/dmux/spec-kit-onboard/releases/download/v2.1.0/x.zip', priority: 5 }))
      .toEqual(['extension', 'add', 'spec-kit-onboard', '--from', 'https://github.com/dmux/spec-kit-onboard/releases/download/v2.1.0/x.zip', '--priority', '5']);
  });

  it('install-community without a URL is a catalog-style add', () => {
    expect(buildSpecifyArgs({ action: 'install-community', id: 'git' })).toEqual(['extension', 'add', 'git']);
  });

  it('rejects non-HTTPS community URLs', () => {
    expect(() => buildSpecifyArgs({ action: 'install-community', id: 'x', fromUrl: 'http://evil.com/x.zip' })).toThrow(/HTTPS/);
  });

  it('allows http for localhost', () => {
    expect(buildSpecifyArgs({ action: 'install-community', id: 'x', fromUrl: 'http://localhost:8080/x.zip' }))
      .toContain('--from');
  });

  it('remove forces non-interactive', () => {
    expect(buildSpecifyArgs({ action: 'remove', id: 'personas' })).toEqual(['extension', 'remove', 'personas', '--force']);
  });

  it('enable/disable/set-priority map to subcommands', () => {
    expect(buildSpecifyArgs({ action: 'enable', id: 'p' })).toEqual(['extension', 'enable', 'p']);
    expect(buildSpecifyArgs({ action: 'disable', id: 'p' })).toEqual(['extension', 'disable', 'p']);
    expect(buildSpecifyArgs({ action: 'set-priority', id: 'p', priority: 20 })).toEqual(['extension', 'set-priority', 'p', '20']);
  });
});
