import { NextResponse } from 'next/server';
import { workflowService } from '../../../adapters/di';
import { getWorkspacePath } from '../../../adapters/primary/api/utils';

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Feature name is required' }, { status: 400 });
    }
    const workspacePath = getWorkspacePath();
    const state = await workflowService.createFeature(workspacePath, name);
    return NextResponse.json(state);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Feature name is required' }, { status: 400 });
    }
    const workspacePath = getWorkspacePath();
    const state = await workflowService.deleteFeature(workspacePath, name);
    return NextResponse.json(state);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
