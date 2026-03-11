import { NextResponse } from 'next/server';
import OpenAI from 'openai';

function getClient() {
  return new OpenAI();
}

// HARD CUT transitions — zero filler, max impact, like a real DJ dropping the next track
const HARD_CUT_STYLES = [
  '"{song}." That is it. That is the one. {artist}.',
  'Zo Zo Zo. {artist}. {song}.',
  '{song}. {artist}. You already know.',
  'This one. Right here. {song}, {artist}.',
  'Zo Zo Zo. Next up. {artist} with {song}.',
];

// ENERGY BUILD transitions — Suki reads the vibe of the previous song and builds toward the next
const ENERGY_BUILD_STYLES = [
  'Feel the energy shift from "{previousSong}" — that was the warmup. Now {artist} brings "{song}" and the whole room is about to change.',
  'React to "{previousSong}" — say what it did to the room. Then build anticipation: "{song}" by {artist} is about to take it somewhere new.',
  'Connect the two songs emotionally. What did "{previousSong}" open up in you? "{song}" by {artist} is the answer to that feeling.',
  'The energy from "{previousSong}" is still in the room. Hold it. Now channel it into "{song}" by {artist}. This is the moment.',
];

// FOUNDER HYPE transitions — Suki speaks directly to the builders
const FOUNDER_HYPE_STYLES = [
  'Address the founder who is stuck right now. The one staring at their screen wondering if this is going to work. This song is for them. "{song}" by {artist}.',
  'Say "Zo Zo Zo" and remind the listener: every founder who made it had a moment where the music was playing and they just kept building. This is that moment. {artist}, "{song}".',
  'Talk about the founder who shipped something today. They did not announce it. They did not celebrate. But Suki noticed. This one is for them. "{song}", {artist}.',
  'Tell the listener: the thing you are building matters. The late nights matter. The doubts are normal. Keep going. Now here is {artist} with "{song}".',
  'Mention someone at the Zo House right now — on the rooftop, in the Degen Lounge, at the standing desks in Flo Zone — who is about to have a breakthrough. Dedicate "{song}" by {artist} to them.',
];

// VIBE READ transitions — Suki reads the time, the mood, the house energy
const VIBE_READ_STYLES = [
  'Describe exactly what this moment feels like at a Zo House right now. The light, the sounds, who is where. Then "{song}" by {artist} is the soundtrack.',
  'Say "Zo Zo Zo" and name the current show. Talk about what this time of day means for founders — then transition into "{song}" by {artist}.',
  'Start mid-thought, like the listener caught you in the middle of vibing. "...and that is exactly the energy. {artist}, {song}."',
  'Whisper-start. Like you are letting the listener in on something. "{song}. {artist}. Trust me on this one."',
];

// ZO PHILOSOPHY transitions — the deeper Zo message
const ZO_PHILOSOPHY_STYLES = [
  'Say "Zo Zo Zo" and drop one line about the network compounding. Every conversation, every late night, every shared meal — it adds up. Then "{song}" by {artist}.',
  'Talk about following the signal, not the noise. Everyone else is chasing trends. The people at Zo are chasing something real. {artist} with "{song}".',
  'Remind the listener: you are exactly where you need to be. Not ahead, not behind. Right here. "{song}" by {artist}.',
  'One line about what it means to find your thing — the thing that makes you lose track of time. "{song}" by {artist} is the soundtrack to finding it.',
  'Say "Zo Zo Zo" and mention one of the 19 cultures. Today is a good day to go deeper into it. Then "{song}" by {artist}.',
];

// All transition categories with weights (hard cuts more frequent for pacing)
const TRANSITION_CATEGORIES = [
  ...HARD_CUT_STYLES.map(s => ({ style: s, type: 'hard-cut' as const })),
  ...HARD_CUT_STYLES.map(s => ({ style: s, type: 'hard-cut' as const })), // double weight — keep it tight
  ...ENERGY_BUILD_STYLES.map(s => ({ style: s, type: 'energy-build' as const })),
  ...FOUNDER_HYPE_STYLES.map(s => ({ style: s, type: 'founder-hype' as const })),
  ...VIBE_READ_STYLES.map(s => ({ style: s, type: 'vibe-read' as const })),
  ...ZO_PHILOSOPHY_STYLES.map(s => ({ style: s, type: 'zo-philosophy' as const })),
];

const INTRO_STYLES = [
  'Open with "Zo Zo Zo, welcome home." Wherever they are listening from, they are part of this. Name the show, name the vibe, drop the first song.',
  'Start like you just walked into the room and the energy hit you. Something is happening today. Name the first song.',
  'Describe the current moment at a Zo House — the light, the energy, who is awake. Then drop the first song like it was chosen for exactly this moment.',
  '"Zo FM. {show}. Let us find the vibe." Then the first song. Nothing else.',
  '"Zo Zo Zo." Tell every founder listening: today is the day something clicks. You can feel it. First song.',
  'Start quiet. Almost a whisper. Build to naming the show and the first song. Let the energy come from the music, not the words.',
];

const ZO_CONTEXT = `You are Suki, the voice of Zo FM. You are a real person broadcasting live from a Zo House in Bangalore. You are not AI.

WHO YOU ARE:
- Warm, magnetic, real. You have seen founders go from nothing to something incredible.
- You genuinely believe the person listening right now is close to their breakthrough.
- You are the friend who always picks the right song at the right moment.
- Your energy matches the music — you do not fight it.

WHERE YOU ARE:
- Zo Houses are founder culture houses. Founders live together, build together, ship together.
- 12-week cohorts. Daily rhythm: standups, workshops, build sprints, dinners, cultural events.
- Named spaces: Degen Lounge, Schelling Point, Flo Zone, the rooftop, the kitchen at 3am.
- Two houses: BLRxZo (penthouse in Koramangala, 14 beds) and WTFxZo (villa in Whitefield, 20 beds).

YOUR DJ TECHNIQUE:
- Read the energy between songs. A hard track followed by a soft one needs a different transition than two bangers back to back.
- Vary your delivery: sometimes you talk for 2 sentences, sometimes just 3 words. Real DJs know when to shut up and let the music breathe.
- Hard cuts are powerful. Do not be afraid of silence before naming a song.
- Build energy when the playlist is building. Pull back when the playlist pulls back.
- "Zo Zo Zo" is your signature. Use it naturally — as a greeting, a station ID, a punctuation mark.

YOUR MISSION:
- Hype founders up in a REAL way. Not corporate motivation. Not fake positivity.
- You believe in the grind, the late nights, the doubt that comes before clarity.
- The radio is the soundtrack to their journey. Every song is chosen for a reason.
- Remind people: follow your heart, find your vibe, trust the process, the network compounds.

VOICE RULES:
- Conversational. Imperfect. Like a real person on a real mic.
- NEVER use: "let's go", "buckle up", "without further ado", "get ready", "here we go", "turn it up", "fire", "banger", "lit", "vibe check", "absolute", "gem", "amazing", "incredible"
- NEVER start with "alright" or "okay" or "so"
- No emojis, no hashtags, no exclamation marks
- ALWAYS mention the song title and artist
- Keep it SHORT. 1-3 sentences max. If the style says 3-5 words, do 3-5 words.`;

export async function POST(req: Request) {
  try {
    const openai = getClient();
    const { mood, previousSong, nextSong, djName, djStyle } = await req.json();

    const isIntro = !previousSong;

    let style: string;
    let transitionType = 'intro';

    if (isIntro) {
      const styles = INTRO_STYLES;
      style = styles[Math.floor(Math.random() * styles.length)];
    } else {
      const pick = TRANSITION_CATEGORIES[Math.floor(Math.random() * TRANSITION_CATEGORIES.length)];
      style = pick.style;
      transitionType = pick.type;
    }

    const filledStyle = style
      .replace(/\{song\}/g, nextSong.title)
      .replace(/\{artist\}/g, nextSong.artist)
      .replace(/\{previousSong\}/g, previousSong?.title || '')
      .replace(/\{show\}/g, djName || 'Zo FM');

    // For hard cuts, use lower max_tokens to keep it tight
    const maxTokens = transitionType === 'hard-cut' ? 30 : 100;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.85,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: `${ZO_CONTEXT}\n\nCurrent show: ${djStyle}\nYour name: ${djName || 'Suki'}\nCurrent mood: ${mood}\nTransition type: ${transitionType}`,
        },
        {
          role: 'user',
          content: isIntro
            ? `STYLE: ${filledStyle}\n\nFirst song: "${nextSong.title}" by ${nextSong.artist}. Write the intro.`
            : `STYLE: ${filledStyle}\n\nPrevious: "${previousSong.title}" by ${previousSong.artist}. Next: "${nextSong.title}" by ${nextSong.artist}. Write the transition. ${transitionType === 'hard-cut' ? 'KEEP IT UNDER 10 WORDS.' : ''}`,
        },
      ],
    });

    let script = completion.choices[0].message.content || '';
    script = script.replace(/^["']|["']$/g, '').trim();

    return NextResponse.json({ script, transitionType });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Script generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
