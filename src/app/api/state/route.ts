import { NextResponse } from 'next/server';
import { workflowService } from '../../../adapters/di';
import { getWorkspacePath } from '../../../adapters/primary/api/utils';

export async function GET() {
  try {
    const workspacePath = getWorkspacePath();
    const state = await workflowService.getWorkflowState(workspacePath);
    return NextResponse.json(state);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { activeFeatureName } = await req.json();
    const workspacePath = getWorkspacePath();
    const state = await workflowService.setActiveFeature(workspacePath, activeFeatureName);
    return NextResponse.json(state);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
