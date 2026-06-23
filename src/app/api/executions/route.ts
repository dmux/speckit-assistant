import { NextResponse } from 'next/server';
import { executionHistory } from '../../../adapters/di';
import { getWorkspacePath } from '../../../adapters/primary/api/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const workspacePath = getWorkspacePath();
    const feature = new URL(req.url).searchParams.get('feature') || undefined;
    const executions = await executionHistory.list(workspacePath, feature ? { feature } : undefined);
    return NextResponse.json({ executions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
