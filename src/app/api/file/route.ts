import { NextResponse } from 'next/server';
import { workflowService } from '../../../adapters/di';
import { getWorkspacePath } from '../../../adapters/primary/api/utils';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }
    const workspacePath = getWorkspacePath();
    const content = await workflowService.readFile(workspacePath, filePath);
    return NextResponse.json({ path: filePath, content });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { path: filePath, content } = await req.json();
    if (!filePath || content === undefined) {
      return NextResponse.json({ error: 'Path and content are required' }, { status: 400 });
    }
    const workspacePath = getWorkspacePath();
    const state = await workflowService.writeFile(workspacePath, filePath, content);
    return NextResponse.json({ success: true, state });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
