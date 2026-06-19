import { NextResponse } from 'next/server';
import { specAgentRepository } from '../../../../adapters/di';
import { getWorkspacePath } from '../../../../adapters/primary/api/utils';
import { SpecAgentsFile } from '../../../../domain/models/specAgents';

export async function POST(req: Request) {
  try {
    const workspacePath = getWorkspacePath();
    // Optionally accept the roster in the body; otherwise use what is persisted.
    let file: SpecAgentsFile | null = null;
    try {
      const body = await req.json();
      if (body && Array.isArray(body.agents)) file = body;
    } catch {
      // no body
    }
    if (!file) file = await specAgentRepository.getAgents(workspacePath);

    const result = await specAgentRepository.applyToSpecKit(workspacePath, file);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
