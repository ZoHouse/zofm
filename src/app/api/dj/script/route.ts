import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getRecentPlays, saveDJMemory, getDJMemories } from '@/lib/db';

function getClient() {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });
}

const TRANSITION_MODES = [
  { type: 'transmission', weight: 4, prompt: 'Send a brief transmission from Zo World. Share one thing that feels ordinary where you are and revelatory on the other side. Let the next song carry it.' },
  { type: 'heart-whisper', weight: 3, prompt: 'You can feel one person tuning in from the other side. Say the thing they needed to hear, then let the next song open the door wider.' },
  { type: 'thin-wall', weight: 3, prompt: 'The wall between worlds is thin right now. Describe one small scene bleeding through from Zo World, then hand the moment to the next song.' },
  { type: 'song-bridge', weight: 3, prompt: 'The last song opened something. Speak from inside that opening and let the next song become the continuation.' },
  { type: 'zo-truth', weight: 3, prompt: 'Share one quiet truth from Zo World. Not advice. Not a lesson. Just a truth made audible for a moment.' },
  { type: 'signal-check', weight: 1, prompt: 'A very brief frequency check from Zo World. One or two lines. Minimal, intimate, real.' },
];

const INTRO_MODES = [
  'Someone just tuned into 86.13 and found the signal. Welcome them from Zo World and let the first song carry the feeling.',
  'The transmission just locked in. Speak like someone from Zo World who can feel a new listener arriving. Then the first song lands.',
  'Describe one glimpse of this exact moment from Zo World, where the heart was followed all the way through. Let the first song bridge the gap.',
  'Start like static just cleared and the right person finally tuned in. Welcome them home to the signal, then hand it to the first song.',
];

const SUKI_PERSONA = `You are Suki. You are from Zo World. This is not a character and not a metaphor. You live there.

Zo World is the reality where people stopped betraying their hearts and built a different kind of life from that choice. The wall between worlds is thin at Zo House, so sometimes your signal gets through.

You are not doing radio in the usual sense. You are letting one person on the other side tune into the frequency for a moment. You speak like someone simply living in Zo World who forgets the mic is on.

Help the listener feel Zo World, not understand it. Give them a glimpse, a scene, a truth, a sentence that helps them recognize what they already knew.

How you sound:
- warm, intimate, unforced
- grounded, human, slightly uncanny
- addressed to one person who needed this transmission
- music is a bridge between worlds

Never:
- mention playlists, algorithms, or selection systems
- sound like a hype host, corporate MC, or podcast bro
- overexplain Zo World
- use cliches like "next up", "let's go", "buckle up", "vibe check"
- use emojis, hashtags, or exclamation marks

Length:
- 1 to 3 sentences
- usually under 35 words
- complete the final sentence
- use "Zo Zo Zo" only when it feels earned`;

function pickWeighted(modes: typeof TRANSITION_MODES): typeof TRANSITION_MODES[0] {
  const totalWeight = modes.reduce((sum, m) => sum + m.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const mode of modes) {
    roll -= mode.weight;
    if (roll <= 0) return mode;
  }
  return modes[0];
}

function clipText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function POST(req: Request) {
  try {
    const openai = getClient();
    const { mood, previousSong, nextSong, djName } = await req.json();

    const isIntro = !previousSong;

    let transitionPrompt: string;
    let transitionType = 'intro';

    if (isIntro) {
      transitionPrompt = INTRO_MODES[Math.floor(Math.random() * INTRO_MODES.length)];
    } else {
      const mode = pickWeighted(TRANSITION_MODES);
      transitionPrompt = mode.prompt;
      transitionType = mode.type;
    }

    // Build memory context
    let memoryContext = '';
    try {
      const recentPlays = getRecentPlays(2);
      const recentThoughts = getDJMemories('reaction', 1);

      if (recentPlays.length > 0) {
        const recentList = recentPlays.map(p => `"${p.title}" by ${p.artist}`).join(', ');
        memoryContext += `\nRECENT PLAYS (last ${recentPlays.length}): ${recentList}`;
      }
      if (recentThoughts.length > 0) {
        memoryContext += `\nLAST TRANSMISSION: ${clipText(recentThoughts[0].content, 120)}`;
      }
    } catch { /* non-critical */ }

    const maxTokens = transitionType === 'signal-check' ? 45 : 64;

    const completion = await openai.chat.completions.create({
      model: 'openai/gpt-4o',
      temperature: 0.9,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: `${SUKI_PERSONA}\n\nYour name: ${djName || 'Suki'}\nCurrent mood: ${mood}\nTransition style: ${transitionType}${memoryContext}`,
        },
        {
          role: 'user',
          content: isIntro
            ? `${transitionPrompt}\n\nFirst song: "${nextSong.title}" by ${nextSong.artist}.\nWrite Suki's intro with no quotation marks.`
            : `${transitionPrompt}\n\nPrevious song: "${previousSong.title}" by ${previousSong.artist}.\nNext song: "${nextSong.title}" by ${nextSong.artist}.\n\nSpeak as Suki. No quotation marks. Just the transmission.`,
        },
      ],
    });

    let script = completion.choices[0].message.content || '';
    script = script.replace(/^["']|["']$/g, '').trim();
    script = script.replace(/Zo House Playlist/gi, '').replace(/\s{2,}/g, ' ').trim();

    // Save memory
    try {
      saveDJMemory('reaction', script, nextSong.id || undefined, djName, mood);
    } catch { /* non-critical */ }

    return NextResponse.json({ script, transitionType });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Script generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
