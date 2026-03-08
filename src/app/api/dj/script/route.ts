import { NextResponse } from 'next/server';
import OpenAI from 'openai';

function getClient() {
  return new OpenAI();
}

export async function POST(req: Request) {
  try {
    const openai = getClient();
    const { mood, previousSong, nextSong, djName, djStyle } = await req.json();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.9,
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `You are ${djName}, a radio DJ on Zo FM. Your style: ${djStyle}. Keep intros to 2-3 short sentences max. Never use emojis. Never use hashtags. Sound natural and conversational — like a real FM DJ. Mention the next song title and artist naturally.`,
        },
        {
          role: 'user',
          content: previousSong
            ? `Mood: ${mood}. "${previousSong.title}" by ${previousSong.artist} just finished. Next up: "${nextSong.title}" by ${nextSong.artist}. Write a transition.`
            : `Mood: ${mood}. You're opening the show. First song: "${nextSong.title}" by ${nextSong.artist}. Write an intro.`,
        },
      ],
    });

    return NextResponse.json({
      script: completion.choices[0].message.content,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Script generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
