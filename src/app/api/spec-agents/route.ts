import { NextResponse } from 'next/server';
import { specAgentRepository } from '../../../adapters/di';
import { getWorkspacePath } from '../../../adapters/primary/api/utils';
import { SpecAgentsFile } from '../../../domain/models/specAgents';

export async function GET() {
  try {
    const workspacePath = getWorkspacePath();
    const file = await specAgentRepository.getAgents(workspacePath);
    return NextResponse.json(file);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SpecAgentsFile;
    if (!body || !Array.isArray(body.agents)) {
      return NextResponse.json({ error: 'Body must be a SpecAgentsFile with an agents array' }, { status: 400 });
    }
    const workspacePath = getWorkspacePath();
    await specAgentRepository.saveAgents(workspacePath, body);
    return NextResponse.json({ success: true, agents: body.agents });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
