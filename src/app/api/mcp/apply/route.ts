import { NextResponse } from 'next/server';
import { mcpConfig, agentRepository } from '../../../../adapters/di';
import { getWorkspacePath } from '../../../../adapters/primary/api/utils';
import { activeAgent } from '../../../../domain/models/agents';

export async function POST(req: Request) {
  try {
    const { agentId } = await req.json();
    const workspacePath = getWorkspacePath();

    const agentsFile = await agentRepository.getAgents(workspacePath);
    const agent = agentId
      ? agentsFile.agents.find(a => a.id === agentId)
      : activeAgent(agentsFile);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const servers = await mcpConfig.getServers(workspacePath);
    const result = await mcpConfig.applyToAgent(workspacePath, agent, servers);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
