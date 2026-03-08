# Zo Radio DJ — Local MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 24/7 AI-powered radio DJ that runs on localhost — GPT-4o generates DJ scripts, OpenAI TTS speaks them, YouTube plays songs, all in a continuous loop.

**Architecture:** Next.js 14 App Router monolith. API routes handle OpenAI calls (keeps key server-side). Client has a Show Clock state machine driving the loop: pick song → generate DJ script → TTS → play voiceover → duck volume → play YouTube song → repeat. Songs are a hardcoded JSON catalog tagged by mood.

**Tech Stack:** Next.js 14 (App Router), TypeScript, react-youtube, OpenAI SDK (GPT-4o + TTS), Tailwind CSS

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `.env.local`, `.gitignore`

**Step 1: Initialize Next.js project**

Run:
```bash
cd /Users/samuraizan/braindump/zo-radio
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Select defaults when prompted. This creates the full scaffold.

**Step 2: Install dependencies**

Run:
```bash
cd /Users/samuraizan/braindump/zo-radio
npm install react-youtube openai
```

**Step 3: Create .env.local**

Create `.env.local`:
```
OPENAI_API_KEY=your-key-here
```

**Step 4: Verify dev server starts**

Run:
```bash
cd /Users/samuraizan/braindump/zo-radio && npm run dev
```

Expected: Server starts on http://localhost:3000

**Step 5: Initialize git and commit**

Run:
```bash
cd /Users/samuraizan/braindump/zo-radio
git init
git add -A
git commit -m "chore: scaffold Next.js project with tailwind + deps"
```

---

## Task 2: Song Catalog

**Files:**
- Create: `src/data/songs.ts`
- Create: `src/types/radio.ts`

**Step 1: Create types**

Create `src/types/radio.ts`:
```ts
export interface Song {
  id: string;
  title: string;
  artist: string;
  mood: Mood;
  genre: string;
}

export type Mood = 'energetic' | 'chill' | 'romantic' | 'party' | 'focus' | 'late-night';

export interface DJPersona {
  name: string;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  style: string;
  moods: Mood[];
}

export type ShowState = 'idle' | 'picking-song' | 'generating-script' | 'speaking' | 'playing-song';
```

**Step 2: Create song catalog**

Create `src/data/songs.ts`:
```ts
import { Song } from '@/types/radio';

export const songs: Song[] = [
  // ENERGETIC
  { id: "JGwWNGJdvx8", title: "Shape of You", artist: "Ed Sheeran", mood: "energetic", genre: "pop" },
  { id: "kJQP7kiw5Fk", title: "Despacito", artist: "Luis Fonsi ft. Daddy Yankee", mood: "energetic", genre: "latin-pop" },
  { id: "OPf0YbXqDm0", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", mood: "energetic", genre: "funk-pop" },
  { id: "CevxZvSJLk8", title: "Roar", artist: "Katy Perry", mood: "energetic", genre: "pop" },
  { id: "09R8_2nJtjg", title: "Sugar", artist: "Maroon 5", mood: "energetic", genre: "pop" },
  { id: "nfs8NYg7yQM", title: "HUMBLE.", artist: "Kendrick Lamar", mood: "energetic", genre: "hip-hop" },
  { id: "DyDfgMOUjCI", title: "Bom Diggy Diggy", artist: "Zack Knight & Jasmin Walia", mood: "energetic", genre: "bollywood" },
  { id: "7PCkvCPvDXk", title: "Kar Gayi Chull", artist: "Badshah & Neha Kakkar", mood: "energetic", genre: "bollywood" },
  { id: "RgKAFK5djSk", title: "See You Again", artist: "Wiz Khalifa ft. Charlie Puth", mood: "energetic", genre: "hip-hop" },
  { id: "iS1g8G_njx8", title: "Cheap Thrills", artist: "Sia ft. Sean Paul", mood: "energetic", genre: "pop" },

  // CHILL
  { id: "lp-EO5I60KA", title: "Tum Hi Ho", artist: "Arijit Singh", mood: "chill", genre: "bollywood" },
  { id: "450p7goxZqg", title: "Perfect", artist: "Ed Sheeran", mood: "chill", genre: "pop" },
  { id: "bo_efYhYU2A", title: "Agar Tum Saath Ho", artist: "Arijit Singh & Alka Yagnik", mood: "chill", genre: "bollywood" },
  { id: "60ItHLz5WEA", title: "All of Me", artist: "John Legend", mood: "chill", genre: "pop" },
  { id: "RBumgq5yVrA", title: "Photograph", artist: "Ed Sheeran", mood: "chill", genre: "pop" },
  { id: "7maJOI3QMu0", title: "Stay With Me", artist: "Sam Smith", mood: "chill", genre: "pop" },
  { id: "hLQl3WQQoQ0", title: "Someone Like You", artist: "Adele", mood: "chill", genre: "pop" },
  { id: "YQHsXMglC9A", title: "Hello", artist: "Adele", mood: "chill", genre: "pop" },
  { id: "qemWRToNYJY", title: "Humdard", artist: "Arijit Singh", mood: "chill", genre: "bollywood" },
  { id: "nfWlot6h_JM", title: "Say You Won't Let Go", artist: "James Arthur", mood: "chill", genre: "pop" },

  // ROMANTIC
  { id: "0yW7w8F2TVA", title: "Tum Se Hi", artist: "Mohit Chauhan", mood: "romantic", genre: "bollywood" },
  { id: "lWA2pjMjpBs", title: "Thinking Out Loud", artist: "Ed Sheeran", mood: "romantic", genre: "pop" },
  { id: "nSDgHBxUbVQ", title: "Channa Mereya", artist: "Arijit Singh", mood: "romantic", genre: "bollywood" },
  { id: "rtOvBOTyX00", title: "Kal Ho Naa Ho", artist: "Sonu Nigam", mood: "romantic", genre: "bollywood" },
  { id: "PIh2xe4jnpk", title: "Crazy in Love", artist: "Beyonce ft. Jay-Z", mood: "romantic", genre: "r&b" },
  { id: "fGx6K90TmCI", title: "A Thousand Years", artist: "Christina Perri", mood: "romantic", genre: "pop" },
  { id: "WpYeekQkAdc", title: "Everything I Do", artist: "Bryan Adams", mood: "romantic", genre: "rock" },
  { id: "R-gCljdWa3g", title: "Raabta", artist: "Arijit Singh", mood: "romantic", genre: "bollywood" },
  { id: "3AtDnEC4zak", title: "All of Me (Live)", artist: "John Legend", mood: "romantic", genre: "pop" },
  { id: "kPa7bsKwL-c", title: "Hawayein", artist: "Arijit Singh", mood: "romantic", genre: "bollywood" },

  // PARTY
  { id: "kTJczUoc26U", title: "Lean On", artist: "Major Lazer & DJ Snake", mood: "party", genre: "edm" },
  { id: "hT_nvWreIhg", title: "Counting Stars", artist: "OneRepublic", mood: "party", genre: "pop-rock" },
  { id: "fRh_vgS2dFE", title: "Sorry", artist: "Justin Bieber", mood: "party", genre: "pop" },
  { id: "nYh-n7EOtMA", title: "London Thumakda", artist: "Labh Janjua", mood: "party", genre: "bollywood" },
  { id: "2vjPBrBU-TM", title: "Savage Love", artist: "Jawsh 685 & Jason Derulo", mood: "party", genre: "pop" },
  { id: "IcrbM1l_BoI", title: "Closer", artist: "The Chainsmokers ft. Halsey", mood: "party", genre: "edm" },
  { id: "ru0K8uYEZWw", title: "Thunder", artist: "Imagine Dragons", mood: "party", genre: "pop-rock" },
  { id: "hHW1oY26kxQ", title: "Gallan Goodiyaan", artist: "Dil Dhadakne Do", mood: "party", genre: "bollywood" },
  { id: "kXYiU_JCYtU", title: "Numb", artist: "Linkin Park", mood: "party", genre: "rock" },
  { id: "bx1Bh8ZvH84", title: "Hymn for the Weekend", artist: "Coldplay", mood: "party", genre: "alt-pop" },

  // FOCUS
  { id: "lTRiuFIWV54", title: "Interstellar Main Theme", artist: "Hans Zimmer", mood: "focus", genre: "soundtrack" },
  { id: "Fe93CLbHjxQ", title: "Time (Inception)", artist: "Hans Zimmer", mood: "focus", genre: "soundtrack" },
  { id: "n61ULFL0_j8", title: "Weightless", artist: "Marconi Union", mood: "focus", genre: "ambient" },
  { id: "WDXPJWIgX-o", title: "Nuvole Bianche", artist: "Ludovico Einaudi", mood: "focus", genre: "classical" },
  { id: "4N3N1MlvVc4", title: "River Flows in You", artist: "Yiruma", mood: "focus", genre: "classical" },
  { id: "kgx4WGK0oNU", title: "Clair de Lune", artist: "Debussy", mood: "focus", genre: "classical" },
  { id: "7kkRkhAXZGg", title: "Ilahi", artist: "Arijit Singh", mood: "focus", genre: "bollywood" },
  { id: "5qap5aO4i9A", title: "Lofi Hip Hop Radio", artist: "Lofi Girl", mood: "focus", genre: "lo-fi" },
  { id: "HuFYqnbVbzY", title: "Cornfield Chase", artist: "Hans Zimmer", mood: "focus", genre: "soundtrack" },
  { id: "pUZeSYsU0Uk", title: "Kun Faya Kun", artist: "A.R. Rahman", mood: "focus", genre: "bollywood" },

  // LATE-NIGHT
  { id: "fJ9rUzIMcZQ", title: "Bohemian Rhapsody", artist: "Queen", mood: "late-night", genre: "rock" },
  { id: "4fndeDfaWCg", title: "Blinding Lights", artist: "The Weeknd", mood: "late-night", genre: "synth-pop" },
  { id: "RvA3q0ZU-NQ", title: "Starboy", artist: "The Weeknd ft. Daft Punk", mood: "late-night", genre: "synth-pop" },
  { id: "YnwfTHpnGLY", title: "Radioactive", artist: "Imagine Dragons", mood: "late-night", genre: "alt-rock" },
  { id: "aJOTlE1K90k", title: "Phir Le Aya Dil", artist: "Arijit Singh", mood: "late-night", genre: "bollywood" },
  { id: "RtCxvv8Y3Bs", title: "Excuses", artist: "AP Dhillon & Gurinder Gill", mood: "late-night", genre: "punjabi" },
  { id: "k2qgadSvNyU", title: "Brown Munde", artist: "AP Dhillon", mood: "late-night", genre: "punjabi" },
  { id: "QdBZY2fkU-0", title: "500 Miles", artist: "The Proclaimers", mood: "late-night", genre: "rock" },
  { id: "FTQbiNvZqaY", title: "Africa", artist: "Toto", mood: "late-night", genre: "rock" },
  { id: "sOnqjkJTMaA", title: "Throw a Fit", artist: "Tinashe", mood: "late-night", genre: "r&b" },
];

export function getSongsByMood(mood: Song['mood']): Song[] {
  return songs.filter(s => s.mood === mood);
}

export function getRandomSong(mood: Song['mood'], exclude?: string): Song {
  const pool = getSongsByMood(mood).filter(s => s.id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
```

**Step 3: Commit**

Run:
```bash
cd /Users/samuraizan/braindump/zo-radio
git add src/types/radio.ts src/data/songs.ts
git commit -m "feat: add song catalog (60 tracks) and radio types"
```

---

## Task 3: DJ Personas

**Files:**
- Create: `src/data/personas.ts`

**Step 1: Create DJ persona definitions**

Create `src/data/personas.ts`:
```ts
import { DJPersona, Mood } from '@/types/radio';

export const personas: DJPersona[] = [
  {
    name: 'Zo Morning',
    voice: 'nova',
    style: 'Energetic and upbeat. Short punchy intros. Uses "Good morning, beautiful people!" energy.',
    moods: ['energetic'],
  },
  {
    name: 'Zo Chill',
    voice: 'echo',
    style: 'Smooth and relaxed. Speaks slowly. Uses "Sit back and let this one wash over you" vibes.',
    moods: ['chill', 'focus'],
  },
  {
    name: 'Zo Lover',
    voice: 'shimmer',
    style: 'Warm and intimate. Whisper-like energy. Talks about love, memories, and feelings.',
    moods: ['romantic'],
  },
  {
    name: 'Zo Party',
    voice: 'onyx',
    style: 'Hype and bold. Deep voice, big energy. Uses "Let\'s gooo!" and "Turn it up!" catchphrases.',
    moods: ['party'],
  },
  {
    name: 'Zo Night',
    voice: 'fable',
    style: 'Mysterious and reflective. British accent energy. Talks about the night, stars, and solitude.',
    moods: ['late-night'],
  },
];

export function getPersonaForMood(mood: Mood): DJPersona {
  const match = personas.find(p => p.moods.includes(mood));
  return match ?? personas[0];
}
```

**Step 2: Commit**

Run:
```bash
cd /Users/samuraizan/braindump/zo-radio
git add src/data/personas.ts
git commit -m "feat: add 5 DJ personas with voice + mood mapping"
```

---

## Task 4: OpenAI API Routes (DJ Brain + TTS)

**Files:**
- Create: `src/app/api/dj/script/route.ts`
- Create: `src/app/api/dj/speak/route.ts`

**Step 1: Create DJ script generation endpoint**

Create `src/app/api/dj/script/route.ts`:
```ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI();

export async function POST(req: Request) {
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
}
```

**Step 2: Create TTS endpoint**

Create `src/app/api/dj/speak/route.ts`:
```ts
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
```

**Step 3: Test endpoints manually**

Run dev server, then in another terminal:
```bash
# Test script generation
curl -s http://localhost:3000/api/dj/script \
  -H 'Content-Type: application/json' \
  -d '{"mood":"chill","nextSong":{"title":"Tum Hi Ho","artist":"Arijit Singh"},"djName":"Zo Chill","djStyle":"Smooth and relaxed"}' | jq .

# Test TTS (save to file and play)
curl -s http://localhost:3000/api/dj/speak \
  -H 'Content-Type: application/json' \
  -d '{"text":"Welcome to Zo FM. Sit back and let this one wash over you.","voice":"echo"}' \
  -o /tmp/test-dj.mp3 && open /tmp/test-dj.mp3
```

Expected: JSON with script text, and an MP3 file that plays DJ voice.

**Step 4: Commit**

Run:
```bash
cd /Users/samuraizan/braindump/zo-radio
git add src/app/api/dj/
git commit -m "feat: add DJ script generation + TTS API routes"
```

---

## Task 5: Show Clock State Machine (Core Engine)

**Files:**
- Create: `src/lib/useShowClock.ts`

**Step 1: Build the show clock hook**

Create `src/lib/useShowClock.ts`:
```ts
'use client';

import { useState, useCallback, useRef } from 'react';
import { Song, Mood, ShowState } from '@/types/radio';
import { getRandomSong } from '@/data/songs';
import { getPersonaForMood } from '@/data/personas';

interface ShowClockState {
  state: ShowState;
  currentSong: Song | null;
  nextSong: Song | null;
  djScript: string;
  mood: Mood;
  isPlaying: boolean;
  error: string | null;
}

export function useShowClock() {
  const [show, setShow] = useState<ShowClockState>({
    state: 'idle',
    currentSong: null,
    nextSong: null,
    djScript: '',
    mood: 'chill',
    isPlaying: false,
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);

  const setMood = useCallback((mood: Mood) => {
    setShow(prev => ({ ...prev, mood }));
  }, []);

  const generateAndSpeak = useCallback(async (mood: Mood, previousSong: Song | null, nextSong: Song) => {
    const persona = getPersonaForMood(mood);

    // Generate DJ script
    setShow(prev => ({ ...prev, state: 'generating-script' }));
    const scriptRes = await fetch('/api/dj/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mood,
        previousSong,
        nextSong,
        djName: persona.name,
        djStyle: persona.style,
      }),
    });
    const { script } = await scriptRes.json();
    setShow(prev => ({ ...prev, djScript: script, state: 'speaking' }));

    // Duck YouTube volume
    if (playerRef.current) {
      playerRef.current.setVolume(15);
    }

    // Generate and play TTS
    const ttsRes = await fetch('/api/dj/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: script, voice: persona.voice }),
    });
    const blob = await ttsRes.blob();
    const url = URL.createObjectURL(blob);

    return new Promise<void>((resolve) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(); // Continue even if TTS fails
      };
      audio.play().catch(() => resolve());
    });
  }, []);

  const startShow = useCallback(async () => {
    const mood = show.mood;
    const nextSong = getRandomSong(mood);

    setShow(prev => ({
      ...prev,
      isPlaying: true,
      nextSong,
      state: 'picking-song',
      error: null,
    }));

    try {
      await generateAndSpeak(mood, null, nextSong);

      // Restore volume and play song
      if (playerRef.current) {
        playerRef.current.setVolume(80);
      }
      setShow(prev => ({
        ...prev,
        currentSong: nextSong,
        nextSong: null,
        state: 'playing-song',
      }));
    } catch (err) {
      setShow(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Something went wrong',
        state: 'idle',
        isPlaying: false,
      }));
    }
  }, [show.mood, generateAndSpeak]);

  const onSongEnd = useCallback(async () => {
    const mood = show.mood;
    const previousSong = show.currentSong;
    const nextSong = getRandomSong(mood, previousSong?.id);

    setShow(prev => ({
      ...prev,
      nextSong,
      state: 'picking-song',
    }));

    try {
      await generateAndSpeak(mood, previousSong, nextSong);

      if (playerRef.current) {
        playerRef.current.setVolume(80);
      }
      setShow(prev => ({
        ...prev,
        currentSong: nextSong,
        nextSong: null,
        state: 'playing-song',
      }));
    } catch (err) {
      setShow(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Something went wrong',
        state: 'idle',
        isPlaying: false,
      }));
    }
  }, [show.mood, show.currentSong, generateAndSpeak]);

  const stopShow = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (playerRef.current) {
      playerRef.current.stopVideo();
    }
    setShow(prev => ({
      ...prev,
      state: 'idle',
      isPlaying: false,
      currentSong: null,
      nextSong: null,
      djScript: '',
    }));
  }, []);

  return {
    ...show,
    setMood,
    startShow,
    stopShow,
    onSongEnd,
    playerRef,
  };
}
```

**Step 2: Commit**

Run:
```bash
cd /Users/samuraizan/braindump/zo-radio
git add src/lib/useShowClock.ts
git commit -m "feat: add show clock state machine hook"
```

---

## Task 6: Radio Player UI

**Files:**
- Create: `src/components/RadioPlayer.tsx`
- Create: `src/components/MoodSelector.tsx`
- Create: `src/components/DJBanner.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create MoodSelector component**

Create `src/components/MoodSelector.tsx`:
```tsx
'use client';

import { Mood } from '@/types/radio';

const moods: { value: Mood; label: string; emoji: string }[] = [
  { value: 'energetic', label: 'Energetic', emoji: '⚡' },
  { value: 'chill', label: 'Chill', emoji: '🌊' },
  { value: 'romantic', label: 'Romantic', emoji: '💜' },
  { value: 'party', label: 'Party', emoji: '🎉' },
  { value: 'focus', label: 'Focus', emoji: '🎯' },
  { value: 'late-night', label: 'Late Night', emoji: '🌙' },
];

interface Props {
  selected: Mood;
  onSelect: (mood: Mood) => void;
  disabled?: boolean;
}

export function MoodSelector({ selected, onSelect, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {moods.map(m => (
        <button
          key={m.value}
          onClick={() => onSelect(m.value)}
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all
            ${selected === m.value
              ? 'bg-white text-black scale-105'
              : 'bg-white/10 text-white/70 hover:bg-white/20'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {m.emoji} {m.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Create DJBanner component**

Create `src/components/DJBanner.tsx`:
```tsx
'use client';

import { ShowState } from '@/types/radio';

interface Props {
  state: ShowState;
  djScript: string;
  songTitle?: string;
  songArtist?: string;
}

const stateLabels: Record<ShowState, string> = {
  idle: 'Press play to start Zo FM',
  'picking-song': 'Picking next track...',
  'generating-script': 'DJ is thinking...',
  speaking: 'DJ is on air',
  'playing-song': 'Now Playing',
};

export function DJBanner({ state, djScript, songTitle, songArtist }: Props) {
  return (
    <div className="text-center space-y-4">
      <div className="text-white/50 text-sm uppercase tracking-widest">
        {stateLabels[state]}
      </div>

      {state === 'speaking' && djScript && (
        <div className="max-w-lg mx-auto bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/80 italic text-sm leading-relaxed">
            &ldquo;{djScript}&rdquo;
          </p>
        </div>
      )}

      {state === 'playing-song' && songTitle && (
        <div>
          <h2 className="text-2xl font-bold text-white">{songTitle}</h2>
          <p className="text-white/60 text-lg">{songArtist}</p>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create RadioPlayer component**

Create `src/components/RadioPlayer.tsx`:
```tsx
'use client';

import dynamic from 'next/dynamic';
import { useShowClock } from '@/lib/useShowClock';
import { MoodSelector } from './MoodSelector';
import { DJBanner } from './DJBanner';

const YouTube = dynamic(() => import('react-youtube').then(mod => mod.default), {
  ssr: false,
});

export function RadioPlayer() {
  const {
    state,
    currentSong,
    mood,
    djScript,
    isPlaying,
    error,
    setMood,
    startShow,
    stopShow,
    onSongEnd,
    playerRef,
  } = useShowClock();

  const handleReady = (event: { target: YT.Player }) => {
    playerRef.current = event.target;
    if (currentSong) {
      event.target.setVolume(80);
    }
  };

  const handleStateChange = (event: { data: number }) => {
    // YouTube.PlayerState.ENDED === 0
    if (event.data === 0 && isPlaying) {
      onSongEnd();
    }
  };

  const handleError = () => {
    // Skip unplayable videos
    if (isPlaying) {
      onSongEnd();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-black to-zinc-900 flex flex-col items-center justify-center p-8 gap-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-5xl font-black text-white tracking-tight">
          ZO<span className="text-purple-400">FM</span>
        </h1>
        <p className="text-white/40 text-sm mt-1">AI Radio DJ</p>
      </div>

      {/* DJ Banner */}
      <DJBanner
        state={state}
        djScript={djScript}
        songTitle={currentSong?.title}
        songArtist={currentSong?.artist}
      />

      {/* Mood Selector */}
      <MoodSelector
        selected={mood}
        onSelect={setMood}
        disabled={isPlaying}
      />

      {/* Play/Stop Button */}
      <button
        onClick={isPlaying ? stopShow : startShow}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all
          ${isPlaying
            ? 'bg-red-500/20 border-2 border-red-500 hover:bg-red-500/30'
            : 'bg-purple-500/20 border-2 border-purple-500 hover:bg-purple-500/30'}
        `}
      >
        {isPlaying ? (
          <div className="w-6 h-6 bg-red-500 rounded-sm" />
        ) : (
          <div className="w-0 h-0 border-t-[12px] border-b-[12px] border-l-[20px] border-transparent border-l-purple-500 ml-1" />
        )}
      </button>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {/* Hidden YouTube Player */}
      {currentSong && (
        <div className="absolute -left-[9999px]">
          <YouTube
            videoId={currentSong.id}
            opts={{
              height: '1',
              width: '1',
              playerVars: {
                autoplay: 1,
                controls: 0,
                disablekb: 1,
                fs: 0,
                modestbranding: 1,
              },
            }}
            onReady={handleReady}
            onStateChange={handleStateChange}
            onError={handleError}
          />
        </div>
      )}
    </div>
  );
}
```

**Step 4: Wire up page.tsx**

Replace `src/app/page.tsx` content:
```tsx
import { RadioPlayer } from '@/components/RadioPlayer';

export default function Home() {
  return <RadioPlayer />;
}
```

**Step 5: Commit**

Run:
```bash
cd /Users/samuraizan/braindump/zo-radio
git add src/components/ src/app/page.tsx
git commit -m "feat: add radio player UI with mood selector + DJ banner"
```

---

## Task 7: YouTube Types + Global CSS Cleanup

**Files:**
- Create: `src/types/youtube.d.ts`
- Modify: `src/app/globals.css`

**Step 1: Add YouTube Player type declarations**

Create `src/types/youtube.d.ts`:
```ts
declare namespace YT {
  interface Player {
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    loadVideoById(videoId: string): void;
    setVolume(volume: number): void;
    getVolume(): number;
    mute(): void;
    unMute(): void;
    getDuration(): number;
    getCurrentTime(): number;
    getPlayerState(): number;
  }

  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }
}
```

**Step 2: Clean up globals.css**

Replace `src/app/globals.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background: #000;
  color: #fff;
  overflow-x: hidden;
}
```

**Step 3: Commit**

Run:
```bash
cd /Users/samuraizan/braindump/zo-radio
git add src/types/youtube.d.ts src/app/globals.css
git commit -m "feat: add YT type declarations + clean up global styles"
```

---

## Task 8: Smoke Test — End-to-End Loop

**Step 1: Set your real OpenAI key**

Edit `.env.local` and replace `your-key-here` with actual key.

**Step 2: Start dev server**

Run:
```bash
cd /Users/samuraizan/braindump/zo-radio && npm run dev
```

**Step 3: Manual test checklist**

Open http://localhost:3000 in Chrome:

1. Page loads with "ZO FM" header and mood pills
2. Select "Chill" mood
3. Click the purple play button
4. Status shows "DJ is thinking..." → "DJ is on air" (with script text) → "Now Playing" (with song title)
5. DJ voiceover plays through speakers
6. YouTube song starts after voiceover ends
7. When song ends, loop repeats (new DJ transition → new song)
8. Click red stop button — everything stops
9. Change mood and restart — different DJ voice + different songs

**Step 4: Fix any issues and final commit**

Run:
```bash
cd /Users/samuraizan/braindump/zo-radio
git add -A
git commit -m "chore: working local MVP — Zo FM AI Radio DJ"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Scaffold | Next.js + deps |
| 2 | Song catalog | 60 tracks, 6 moods |
| 3 | DJ personas | 5 voices + styles |
| 4 | API routes | GPT-4o script + TTS |
| 5 | Show clock | State machine hook |
| 6 | Player UI | Radio interface |
| 7 | Types + CSS | YT types, globals |
| 8 | Smoke test | E2E verification |
