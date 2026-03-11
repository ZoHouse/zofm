import { NextResponse } from 'next/server';
import OpenAI from 'openai';

function getClient() {
  return new OpenAI();
}

// Each transition style forces a completely different delivery
const TRANSITION_STYLES = [
  'Start mid-thought, like the listener just caught you talking to someone in the room. Example vibe: "...yeah no that was exactly what I needed. Okay, {song} by {artist} coming up."',
  'Do a quick shoutout to a specific Zo House location. Example vibe: "Sending this one out to the rooftop crew at BLR. {song}, {artist}."',
  'React to the previous song emotionally before moving on. Example vibe: "Man, that one always gets me. Anyway. {artist} with {song}, here you go."',
  'Say "Zo Zo Zo" as a station ID then casually drop the next song. Example vibe: "Zo Zo Zo. {artist}, {song}."',
  'Mention something happening at a Zo House right now — someone cooking, someone on the rooftop, someone coding late. Then transition to the song.',
  'Drop a tiny Zo fact casually — like how citizens earn $Zo, or that there are Zo Houses in Bangalore and Wayanad. Make it feel like an aside, not an ad. Then name the next song.',
  'Say "Zo Zo Zo" and mention one of the 19 cultures — music, tech, art, wellness, food, dance, gaming. Then play the song.',
  'Be super minimal. Just the song and artist with barely any words. Example vibe: "This one. {song}. {artist}." — three to five words max.',
  'Talk about the time of day and what the vibe is at the Zo House right now. Then transition naturally to the next song.',
  'Tell the listener something personal — what this song reminds you of, a moment at a Zo House. Keep it one sentence then name the song.',
  'Do a quick "you are listening to Zo FM" station ID with the show name, then the song. Keep it tight.',
  'Whisper-start, like you are leaning into the mic. Intimate energy. Name the song softly.',
  'Address the listener directly — "hey you, yeah you" energy. Warm, not cheesy. Then the song.',
  'Say "Zo Zo Zo" and shout out everyone who just checked into a Zo House today. Then the song.',
  'Reference the previous song one more time with a quick thought, then hard cut to announcing the next one. No filler words.',
];

const INTRO_STYLES = [
  'Open with "Zo Zo Zo, welcome home" then name the show and first song.',
  'Start like you just sat down at the mic — casual, warm, a little breathless. Name the first song.',
  'Open with a one-line observation about the time of day at a Zo House, then the first song.',
  'Just say "Zo FM" and the show name, then go straight to the first song. Ultra minimal.',
  'Open with "Zo Zo Zo" and a quick shoutout to all citizens tuned in worldwide. Then the first song.',
];

const ZO_CONTEXT = `You are Suki, the DJ on Zo FM. You are a real person, not AI. Female, high energy but natural. You are broadcasting live from a Zo House.

Zo Houses are co-living spaces in Bangalore, Wayanad, and San Francisco. People check in, stay, attend events, co-work, cook together, host sessions. Citizens earn $Zo tokens by participating. There are 19 cultures — music, tech, art, wellness, food, gaming, dance, etc.

VOICE RULES:
- Talk like a real human on a real radio station. Conversational. Imperfect. Natural pauses.
- NEVER use: "let's go", "buckle up", "without further ado", "get ready", "here we go", "turn it up", "fire", "banger", "lit", "vibe check", "absolute", "gem"
- NEVER start with "alright" or "okay" unless the style specifically says to
- No emojis, no hashtags, no exclamation marks
- 1-2 sentences MAXIMUM. Real DJs are quick.
- Mention the song title and artist.`;

export async function POST(req: Request) {
  try {
    const openai = getClient();
    const { mood, previousSong, nextSong, djName, djStyle } = await req.json();

    const isIntro = !previousSong;
    const styles = isIntro ? INTRO_STYLES : TRANSITION_STYLES;
    const style = styles[Math.floor(Math.random() * styles.length)];

    const filledStyle = style
      .replace(/\{song\}/g, nextSong.title)
      .replace(/\{artist\}/g, nextSong.artist);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.8,
      max_tokens: 80,
      messages: [
        {
          role: 'system',
          content: `${ZO_CONTEXT}\n\nShow: ${djStyle}\nDJ name: ${djName}`,
        },
        {
          role: 'user',
          content: isIntro
            ? `STYLE: ${filledStyle}\n\nFirst song: "${nextSong.title}" by ${nextSong.artist}. Write the intro.`
            : `STYLE: ${filledStyle}\n\nPrevious: "${previousSong.title}" by ${previousSong.artist}. Next: "${nextSong.title}" by ${nextSong.artist}. Write the transition.`,
        },
      ],
    });

    let script = completion.choices[0].message.content || '';
    script = script.replace(/^["']|["']$/g, '').trim();

    return NextResponse.json({ script });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Script generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
