// src/lib/types.ts

export interface Song {
  id: string;
  title: string;
  artist: string;
  mood: string;
  genre: string;
  duration: number;
}

export interface Slot {
  name: string;
  mood: string;
  djName: string;
  voice: string;
  startHour: number;
  endHour: number;
}

export interface TimelineEntry {
  song: Song;
  startTime: string;   // ISO 8601
  endTime: string;      // ISO 8601
  seekTo: number;       // seconds into song (0 for full plays)
  index: number;
  djBreak: {
    windowStart: string; // ISO — 25s before song ends (prefetch DJ)
    windowEnd: string;   // ISO — when next song starts
    nextSong: Song;
    clipId: string | null; // null = not yet generated
  } | null; // null for last song in slot (slot transition)
}

export interface Timeline {
  slot: Slot;
  entries: TimelineEntry[];
  generatedAt: string;  // ISO
}

// SSE event types pushed to clients
export type RadioEvent =
  | { type: 'connected'; data: { slot: Slot; currentEntry: TimelineEntry } }
  | { type: 'song-start'; data: { entry: TimelineEntry } }
  | { type: 'dj-break-start'; data: { clipId: string; clipUrl: string; script: string; nextSong: Song; duckMusicTo: number } }
  | { type: 'dj-break-ready'; data: { clipId: string; clipUrl: string; script: string; forNextSongId: string } }
  | { type: 'song-end'; data: { songId: string; nextSongId: string } }
  | { type: 'slot-change'; data: { slot: Slot; firstEntry: TimelineEntry } }
  | { type: 'heartbeat'; data: { serverTime: string } };
