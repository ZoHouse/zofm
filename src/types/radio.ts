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
