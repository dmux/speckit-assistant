import { NextResponse } from 'next/server';
import { workflowService } from '../../../adapters/di';
import { getWorkspacePath } from '../../../adapters/primary/api/utils';
import { WorkflowPhase, AgentConfig, PersonaConfig } from '../../../domain/models/types';

export async function POST(req: Request) {
  try {
    const { action, phase, featureName, agentConfig, prompt, text, cols, rows, personaId, personas } = await req.json();

    if (!action || !phase) {
      return NextResponse.json({ error: 'Missing action or phase' }, { status: 400 });
    }

    const workspacePath = getWorkspacePath();

    if (action === 'approve') {
      const state = await workflowService.approvePhase(workspacePath, phase, featureName);
      return NextResponse.json(state);
    }

    if (action === 'discard') {
      const state = await workflowService.discardPhase(workspacePath, phase, featureName);
      return NextResponse.json(state);
    }

    if (action === 'input') {
      const success = await workflowService.writeStdin(phase, featureName, text, personaId);
      return NextResponse.json({ success });
    }

    if (action === 'resize') {
      const success = await workflowService.resize(phase, featureName, cols, rows, personaId);
      return NextResponse.json({ success });
    }

    if (action === 'stop') {
      const success = await workflowService.stop(phase, featureName, personaId);
      return NextResponse.json({ success });
    }

    if (action === 'run' || action === 'run-gate') {
      const encoder = new TextEncoder();
      const customReadableStream = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: any) => {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          };

          try {
            const onData = (t: string) => sendEvent('log', { text: t });
            const finalState = action === 'run-gate'
              ? await workflowService.runImplementationGate(
                  workspacePath,
                  featureName,
                  agentConfig as AgentConfig,
                  (personas ?? []) as PersonaConfig[],
                  onData
                )
              : await workflowService.runPhase(
                  workspacePath,
                  phase,
                  featureName,
                  agentConfig as AgentConfig,
                  prompt,
                  onData,
                  personas as PersonaConfig[] | undefined
                );
            sendEvent('done', { state: finalState });
            controller.close();
          } catch (err: any) {
            sendEvent('error', { message: err.message });
            controller.close();
          }
        }
      });

      return new Response(customReadableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
