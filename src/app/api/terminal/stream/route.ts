import { terminalManager } from '../../../../adapters/primary/api/terminalManager';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let listener: ((data: string) => void) | null = null;
  let interval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      listener = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ output: data })}\n\n`));
      };

      terminalManager.addListener(listener);

      // Keep-alive heartbeat to prevent gateway timeouts
      interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          // ignore
        }
      }, 15000);
    },
    cancel() {
      if (interval) {
        clearInterval(interval);
      }
      if (listener) {
        terminalManager.removeListener(listener);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
