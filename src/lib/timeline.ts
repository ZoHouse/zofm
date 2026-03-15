import { getSongsByMood } from './db';
import type { Song, Slot, TimelineEntry, Timeline } from './types';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getISTDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + IST_OFFSET_MS + now.getTimezoneOffset() * 60000);
}

function getISTHour(): number {
  return getISTDate().getHours();
}

function getDaySeed(): number {
  const ist = getISTDate();
  const dateStr = ist.toISOString().slice(0, 10).replace(/-/g, '');
  return parseInt(dateStr, 10);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = ((s >>> 0) % (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const SLOTS: Slot[] = [
  { name: 'Morning Chai',  mood: 'energetic',  startHour: 6,  endHour: 10, voice: 'nova',    djName: 'Suki' },
  { name: 'Common Room',   mood: 'chill',      startHour: 10, endHour: 14, voice: 'nova',    djName: 'Suki' },
  { name: 'Deep Work',     mood: 'focus',      startHour: 14, endHour: 18, voice: 'shimmer', djName: 'Suki' },
  { name: 'House Party',   mood: 'party',      startHour: 18, endHour: 22, voice: 'nova',    djName: 'Suki' },
  { name: 'After Hours',   mood: 'late-night', startHour: 22, endHour: 26, voice: 'nova',    djName: 'Suki' },
  { name: 'Rooftop Hours', mood: 'romantic',   startHour: 2,  endHour: 6,  voice: 'shimmer', djName: 'Suki' },
];

export function getCurrentSlot(): Slot {
  const hour = getISTHour();
  for (const slot of SLOTS) {
    if (slot.startHour <= slot.endHour) {
      if (hour >= slot.startHour && hour < slot.endHour) return slot;
    } else {
      if (hour >= slot.startHour || hour < (slot.endHour % 24)) return slot;
    }
  }
  return SLOTS[0];
}

export function getPlaylistForSlot(slot: Slot): Song[] {
  const moodSongs = getSongsByMood(slot.mood);
  if (moodSongs.length === 0) return [];
  const seed = getDaySeed() + slot.startHour;
  return seededShuffle(moodSongs, seed);
}

export function computeTimeline(): Timeline | null {
  const slot = getCurrentSlot();
  const playlist = getPlaylistForSlot(slot);
  if (playlist.length === 0) return null;

  const ist = getISTDate();
  const currentHour = ist.getHours();
  const currentMinutes = ist.getMinutes();
  const currentSeconds = ist.getSeconds();

  let hoursIntoSlot = currentHour - slot.startHour;
  if (hoursIntoSlot < 0) hoursIntoSlot += 24;
  const secondsIntoSlot = hoursIntoSlot * 3600 + currentMinutes * 60 + currentSeconds;

  const totalPlaylistDuration = playlist.reduce((sum, s) => sum + s.duration, 0);
  const positionInPlaylist = secondsIntoSlot % totalPlaylistDuration;

  let elapsed = 0;
  let currentIndex = 0;
  let seekTo = 0;
  for (let i = 0; i < playlist.length; i++) {
    if (elapsed + playlist[i].duration > positionInPlaylist) {
      currentIndex = i;
      seekTo = positionInPlaylist - elapsed;
      break;
    }
    elapsed += playlist[i].duration;
  }

  const now = new Date();
  const entries: TimelineEntry[] = [];
  let entryStart = new Date(now.getTime() - seekTo * 1000);

  const entriesToGenerate = Math.min(playlist.length, 30);

  for (let offset = 0; offset < entriesToGenerate; offset++) {
    const idx = (currentIndex + offset) % playlist.length;
    const song = playlist[idx];
    const entrySeek = offset === 0 ? seekTo : 0;
    const effectiveDuration = song.duration - entrySeek;
    const entryEnd = new Date(entryStart.getTime() + effectiveDuration * 1000);

    const nextIdx = (idx + 1) % playlist.length;
    const nextSong = playlist[nextIdx];

    const DJ_PREFETCH_SECONDS = 25;

    entries.push({
      song,
      startTime: entryStart.toISOString(),
      endTime: entryEnd.toISOString(),
      seekTo: entrySeek,
      index: idx,
      djBreak: offset < entriesToGenerate - 1 ? {
        windowStart: new Date(entryEnd.getTime() - DJ_PREFETCH_SECONDS * 1000).toISOString(),
        windowEnd: entryEnd.toISOString(),
        nextSong,
        clipId: null,
      } : null,
    });

    entryStart = entryEnd;
  }

  return {
    slot,
    entries,
    generatedAt: now.toISOString(),
  };
}

export function getCurrentEntry(timeline: Timeline): TimelineEntry | null {
  const now = Date.now();
  for (const entry of timeline.entries) {
    const start = new Date(entry.startTime).getTime();
    const end = new Date(entry.endTime).getTime();
    if (now >= start && now < end) return entry;
  }
  return timeline.entries[0] || null;
}
