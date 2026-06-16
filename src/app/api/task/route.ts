import { NextResponse } from 'next/server';
import { workflowService } from '../../../adapters/di';
import { getWorkspacePath } from '../../../adapters/primary/api/utils';

export async function POST(req: Request) {
  try {
    const { featureName, lineIndex, checked } = await req.json();
    if (!featureName || lineIndex === undefined || checked === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const workspacePath = getWorkspacePath();
    const state = await workflowService.toggleTask(workspacePath, featureName, lineIndex, checked);
    return NextResponse.json(state);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
