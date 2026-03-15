import { NextResponse } from 'next/server';
import { getScheduler } from '@/lib/scheduler';
import { computeTimeline, getCurrentEntry } from '@/lib/timeline';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Ensure scheduler is running
  getScheduler();

  const timeline = computeTimeline();
  if (!timeline) {
    return NextResponse.json({ error: 'No songs available' }, { status: 500 });
  }

  const currentEntry = getCurrentEntry(timeline);

  return NextResponse.json({
    slot: timeline.slot,
    currentEntry,
    entries: timeline.entries,
    listenerCount: 0,
    generatedAt: timeline.generatedAt,
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
