import { getSSEManager } from '@/lib/sse-manager';
import { computeTimeline, getCurrentEntry } from '@/lib/timeline';
import { getScheduler } from '@/lib/scheduler';
import type { RadioEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Ensure scheduler is running (lazy init on first SSE connection)
  getScheduler();

  const timeline = computeTimeline();
  const currentEntry = timeline ? getCurrentEntry(timeline) : null;

  let clientId: string;

  const stream = new ReadableStream({
    start(controller) {
      const manager = getSSEManager();
      clientId = manager.addClient(controller);

      // Send initial state
      if (timeline && currentEntry) {
        const connectEvent: RadioEvent = {
          type: 'connected',
          data: { slot: timeline.slot, currentEntry },
        };
        const data = `event: connected\ndata: ${JSON.stringify(connectEvent.data)}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
      }
    },
    cancel() {
      getSSEManager().removeClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    },
  });
}
