import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI();

export async function POST(req: Request) {
  try {
    const { text, voice } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice || 'onyx',
      input: text,
      response_format: 'mp3',
      speed: 1.0,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

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
