import { NextResponse } from 'next/server';
import { agentRepository } from '../../../adapters/di';
import { getWorkspacePath } from '../../../adapters/primary/api/utils';
import { AgentsFile } from '../../../domain/models/agents';

export async function GET() {
  try {
    const workspacePath = getWorkspacePath();
    const file = await agentRepository.getAgents(workspacePath);
    return NextResponse.json(file);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AgentsFile;
    if (!body || !Array.isArray(body.agents)) {
      return NextResponse.json({ error: 'Body must be an AgentsFile with an agents array' }, { status: 400 });
    }
    const workspacePath = getWorkspacePath();
    await agentRepository.saveAgents(workspacePath, body);
    return NextResponse.json({ success: true, agents: body });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
