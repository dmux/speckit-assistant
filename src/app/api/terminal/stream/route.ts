import { terminalManager } from '../../../../adapters/primary/api/terminalManager';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const listener = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ output: data })}\n\n`));
      };

      terminalManager.addListener(listener);

      // Keep-alive heartbeat to prevent gateway timeouts
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          // ignore
        }
      }, 15000);

      // Clean up when the connection closes
      return () => {
        clearInterval(interval);
        terminalManager.removeListener(listener);
      };
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
