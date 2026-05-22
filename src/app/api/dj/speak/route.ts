import OpenAI from 'openai';
import { NextResponse } from 'next/server';

function getClient() {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });
}

// gpt-audio voice set: alloy, ash, ballad, coral, echo, sage, shimmer, verse.
// Map tts-1-only voices to nearest gpt-audio equivalent so existing callers keep working.
const VOICE_MAP: Record<string, string> = {
  onyx: 'ash',
  fable: 'ballad',
  nova: 'coral',
};
const resolveVoice = (v?: string) => (v && VOICE_MAP[v]) || v || 'ash';

export async function POST(req: Request) {
  try {
    const openai = getClient();
    const { text, voice } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'openai/gpt-audio-mini',
      modalities: ['text', 'audio'],
      audio: { voice: resolveVoice(voice), format: 'mp3' },
      messages: [
        { role: 'system', content: 'You are a TTS engine. Speak the user message verbatim in a natural DJ delivery. Do not paraphrase, comment, or add anything.' },
        { role: 'user', content: text },
      ],
    });

    const b64 = completion.choices?.[0]?.message?.audio?.data;
    if (!b64) {
      return NextResponse.json({ error: 'No audio returned' }, { status: 502 });
    }
    const buffer = Buffer.from(b64, 'base64');

    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
