import { NextResponse } from 'next/server';
import { workflowService, devopsAgentRepository, extensionRepository } from '../../../../adapters/di';
import { getWorkspacePath } from '../../../../adapters/primary/api/utils';
import { AgentConfig } from '../../../../domain/models/types';
import { DEVOPS_AGENTS_EXTENSION_ID } from '../../../../domain/models/devopsAgents';

export async function POST(req: Request) {
  try {
    const { agentId, featureName, agentConfig } = await req.json();
    if (!agentId) return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });

    const workspacePath = getWorkspacePath();

    const roster = await devopsAgentRepository.getAgents(workspacePath);
    const agent = roster.agents.find(a => a.id === agentId);
    if (!agent) return NextResponse.json({ error: `Unknown DevOps agent: ${agentId}` }, { status: 400 });
    if (!agent.enabled) return NextResponse.json({ error: `DevOps agent is disabled: ${agentId}` }, { status: 400 });

    // The slash command only resolves if the bundled devops extension is installed.
    const installed = await extensionRepository.listInstalled(workspacePath);
    const devopsInstalled = installed.some(e => e.id === DEVOPS_AGENTS_EXTENSION_ID && e.enabled);
    if (!devopsInstalled) {
      return NextResponse.json({
        error: 'The DevOps extension is not installed. Install "DevOps Agents" from the Extensions panel first.',
      }, { status: 409 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        try {
          const { exitCode } = await workflowService.runDevOps(
            workspacePath,
            agent,
            featureName ?? null,
            agentConfig as AgentConfig,
            (t: string) => sendEvent('log', { text: t })
          );
          sendEvent('done', { exitCode });
          controller.close();
        } catch (err: any) {
          sendEvent('error', { message: err.message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
