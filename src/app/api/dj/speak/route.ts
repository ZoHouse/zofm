import OpenAI from 'openai';

const openai = new OpenAI();

export async function POST(req: Request) {
  const { text, voice } = await req.json();

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
}
