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

    // gpt-audio on OpenRouter requires streaming for audio output.
    const stream = await openai.chat.completions.create({
      model: 'openai/gpt-audio-mini',
      modalities: ['text', 'audio'],
      audio: { voice: resolveVoice(voice), format: 'mp3' },
      stream: true,
      messages: [
        { role: 'system', content: 'You are a TTS engine. Speak the user message verbatim in a natural DJ delivery. Do not paraphrase, comment, or add anything.' },
        { role: 'user', content: text },
      ],
    });

    let audioB64 = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as { audio?: { data?: string } } | undefined;
      if (delta?.audio?.data) audioB64 += delta.audio.data;
    }

    if (!audioB64) {
      return NextResponse.json({ error: 'No audio returned' }, { status: 502 });
    }
    const buffer = Buffer.from(audioB64, 'base64');

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
