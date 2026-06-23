import { NextResponse } from 'next/server';
import { extensionRepository, specifyCli } from '../../../adapters/di';
import { getWorkspacePath, bundledExtensionDir } from '../../../adapters/primary/api/utils';
import { BUNDLED_EXTENSIONS } from '../../../domain/models/extensions';
import { buildSpecifyArgs, SpecifyActionInput } from '../../../domain/services/specifyArgs';

export async function GET() {
  try {
    const workspacePath = getWorkspacePath();
    const [available, installed] = await Promise.all([
      specifyCli.isAvailable(workspacePath),
      extensionRepository.listInstalled(workspacePath),
    ]);
    return NextResponse.json({ available, installed, bundled: BUNDLED_EXTENSIONS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body || {};
    if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 });

    // Install the `specify` CLI itself (separate from `specify extension ...`).
    if (action === 'install-cli') {
      const wsPath = getWorkspacePath();
      const { code, output } = await specifyCli.installCli(wsPath);
      const available = await specifyCli.isAvailable(wsPath);
      return NextResponse.json({ success: code === 0, code, output, available });
    }

    // Resolve a bundled extension's local directory into a --dev install.
    let input: SpecifyActionInput;
    if (action === 'install-bundled') {
      const bundled = BUNDLED_EXTENSIONS.find(b => b.id === body.id);
      if (!bundled) return NextResponse.json({ error: `Unknown bundled extension: ${body.id}` }, { status: 400 });
      input = { action: 'install-bundled', path: bundledExtensionDir(bundled.dir), priority: body.priority };
    } else {
      input = { ...body } as SpecifyActionInput;
    }

    let args: string[];
    try {
      args = buildSpecifyArgs(input);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const workspacePath = getWorkspacePath();
    const { code, output } = await specifyCli.run(workspacePath, args);
    const installed = await extensionRepository.listInstalled(workspacePath);
    return NextResponse.json({ success: code === 0, code, output, installed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
