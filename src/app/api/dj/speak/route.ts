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

// Wrap raw signed-16-bit PCM in a minimal WAV container (44-byte header).
function pcm16ToWav(pcm: Buffer, sampleRate: number, channels: number): Buffer {
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function POST(req: Request) {
  try {
    const openai = getClient();
    const { text, voice } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    // gpt-audio on OpenRouter requires stream:true, and stream-mode only emits pcm16 (24kHz mono).
    // Accumulate the PCM chunks and wrap in a WAV container so the browser <audio> tag plays it.
    const stream = await openai.chat.completions.create({
      model: 'openai/gpt-audio-mini',
      modalities: ['text', 'audio'],
      audio: { voice: resolveVoice(voice), format: 'pcm16' },
      stream: true,
      messages: [
        { role: 'system', content: 'You are a TTS engine. Speak the user message verbatim in a natural DJ delivery. Do not paraphrase, comment, or add anything.' },
        { role: 'user', content: text },
      ],
    });

    const pcmChunks: Buffer[] = [];
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as { audio?: { data?: string } } | undefined;
      if (delta?.audio?.data) pcmChunks.push(Buffer.from(delta.audio.data, 'base64'));
    }

    if (pcmChunks.length === 0) {
      return NextResponse.json({ error: 'No audio returned' }, { status: 502 });
    }

    const pcm = Buffer.concat(pcmChunks);
    const wav = pcm16ToWav(pcm, 24000, 1);

    return new Response(new Uint8Array(wav), {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': wav.length.toString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
