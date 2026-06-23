import { workflowService } from '../../../../adapters/di';
import { getWorkspacePath } from '../../../../adapters/primary/api/utils';
import * as chokidar from 'chokidar';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const workspacePath = getWorkspacePath();
  const encoder = new TextEncoder();

  const watcher = chokidar.watch([
    path.join(workspacePath, 'specs'),
    path.join(workspacePath, '.specify')
  ], {
    ignoreInitial: true,
    persistent: true,
    depth: 4
  });

  const customReadableStream = new ReadableStream({
    start(controller) {
      const sendUpdate = async (changedFilePath?: string) => {
        try {
          const state = await workflowService.getWorkflowState(workspacePath);
          const relativePath = changedFilePath
            ? path.relative(workspacePath, changedFilePath)
            : null;
          
          const payload = {
            state,
            changedFile: relativePath
          };

          controller.enqueue(
            encoder.encode(`event: update\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          // ignore
        }
      };

      // Watch all change events (add, change, unlink)
      watcher.on('all', (event, filePath) => {
        if (filePath.includes('.git')) return;
        // The internal runtime dir is otherwise noisy, but two files matter to the
        // UI: workflow-state.json (phase statuses, e.g. 'running' — what tells the
        // Kanban a phase is executing) and executions.jsonl (the executions feed).
        // Per-run logs/*.log are intentionally still ignored (too chatty). These
        // reads are read-only, so re-emitting cannot create a write/watch loop.
        if (
          filePath.includes('.runtime') &&
          !filePath.includes('workflow-state.json') &&
          !filePath.includes('executions.jsonl')
        ) return;
        sendUpdate(filePath);
      });
    },
    cancel() {
      watcher.close();
    }
  });

  return new Response(customReadableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  });
}

