import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { songId, actualDuration } = await request.json();

    if (!songId || typeof actualDuration !== 'number' || actualDuration <= 0) {
      return NextResponse.json({ error: 'Invalid songId or actualDuration' }, { status: 400 });
    }

    const db = getDb();
    const song = db.prepare('SELECT id, duration FROM songs WHERE id = ?').get(songId) as { id: string; duration: number } | undefined;

    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    const rounded = Math.round(actualDuration);
    const diff = Math.abs(song.duration - rounded);

    // Only update if there's a meaningful difference (>2s) and the new duration is reasonable
    if (diff > 2 && rounded > 10 && rounded < 36000) {
      db.prepare('UPDATE songs SET duration = ? WHERE id = ?').run(rounded, songId);
      console.log(`[duration-correction] ${songId}: ${song.duration}s -> ${rounded}s (diff: ${diff}s)`);
      return NextResponse.json({ updated: true, oldDuration: song.duration, newDuration: rounded });
    }

    return NextResponse.json({ updated: false, currentDuration: song.duration });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
