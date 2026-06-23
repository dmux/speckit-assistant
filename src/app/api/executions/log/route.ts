import { NextResponse } from 'next/server';
import { executionHistory } from '../../../../adapters/di';
import { getWorkspacePath } from '../../../../adapters/primary/api/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const workspacePath = getWorkspacePath();
    const log = await executionHistory.readLog(workspacePath, id);
    return NextResponse.json({ id, log });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
