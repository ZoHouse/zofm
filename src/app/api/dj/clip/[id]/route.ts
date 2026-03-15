import { getDJClip } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clip = getDJClip(id);

  if (!clip) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(new Uint8Array(clip.audio), {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': clip.audio.length.toString(),
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
