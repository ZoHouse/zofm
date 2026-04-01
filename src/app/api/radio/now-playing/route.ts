import { NextResponse } from 'next/server';
import { getSongsByMood, recordPlay, type SongRow } from '@/lib/db';

// --- IST time helpers ---
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getISTDate() {
  const now = new Date();
  return new Date(now.getTime() + IST_OFFSET_MS + now.getTimezoneOffset() * 60000);
}

function getISTHour() {
  return getISTDate().getHours();
}

function getDaySeed() {
  const ist = getISTDate();
  const dateStr = ist.toISOString().slice(0, 10).replace(/-/g, '');
  return parseInt(dateStr, 10);
}

// --- Schedule slots (IST) ---
const slots = [
  { name: 'Morning Chai',        mood: 'energetic',  startHour: 6,  endHour: 10, voice: 'nova',    djName: 'Suki' },
  { name: 'Common Room',         mood: 'chill',      startHour: 10, endHour: 14, voice: 'nova',    djName: 'Suki' },
  { name: 'Deep Work',           mood: 'focus',      startHour: 14, endHour: 18, voice: 'shimmer', djName: 'Suki' },
  { name: 'House Party',         mood: 'party',      startHour: 18, endHour: 22, voice: 'nova',    djName: 'Suki' },
  { name: 'After Hours',         mood: 'late-night', startHour: 22, endHour: 26, voice: 'nova',    djName: 'Suki' },
  { name: 'Rooftop Hours',       mood: 'romantic',   startHour: 2,  endHour: 6,  voice: 'shimmer', djName: 'Suki' },
];

function getCurrentSlot() {
  const hour = getISTHour();
  for (const slot of slots) {
    if (slot.startHour <= slot.endHour) {
      if (hour >= slot.startHour && hour < slot.endHour) return slot;
    } else {
      if (hour >= slot.startHour || hour < (slot.endHour % 24)) return slot;
    }
  }
  return slots[0];
}

// --- Seeded shuffle (deterministic for a given seed) ---
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

// Track last recorded song to avoid duplicate play records
let lastRecordedSongId: string | null = null;

// --- Core: compute what's playing right now ---
// If `playingSongId` is provided, the client is telling us what it's actually
// playing — we find that song in the playlist and return the correct next/prev
// relative to it, eliminating duration-drift mismatches.
function getNowPlaying(playingSongId?: string) {
  const slot = getCurrentSlot();
  const moodSongs = getSongsByMood(slot.mood);

  if (moodSongs.length === 0) {
    return null;
  }

  // Deterministic shuffle for today + this slot
  const seed = getDaySeed() + slot.startHour;
  const playlist = seededShuffle(moodSongs, seed);

  // --- Client-anchored mode: find client's song in playlist ---
  if (playingSongId) {
    const idx = playlist.findIndex(s => s.id === playingSongId);
    if (idx !== -1) {
      const song = playlist[idx];
      const nextSong = playlist[(idx + 1) % playlist.length];
      const previousSong = idx > 0 ? playlist[idx - 1] : playlist[playlist.length - 1];

      // Record play (deduplicated)
      if (lastRecordedSongId !== song.id) {
        lastRecordedSongId = song.id;
        try { recordPlay(song.id, slot.name, slot.mood, 0); } catch { /* non-critical */ }
      }

      // seekTo 0 — we don't know where the client is in the song,
      // but the client doesn't use seekTo after initial load anyway
      return buildResponse(song, 0, slot, nextSong, previousSong, idx, playlist.length);
    }
    // Song not in current slot's playlist (slot changed?), fall through to time-based
  }

  // --- Time-based mode: calculate from wall clock (used for initial sync) ---
  const ist = getISTDate();
  const slotStartHour = slot.startHour;
  const currentHour = ist.getHours();
  const currentMinutes = ist.getMinutes();
  const currentSeconds = ist.getSeconds();

  let hoursIntoSlot = currentHour - slotStartHour;
  if (hoursIntoSlot < 0) hoursIntoSlot += 24;

  const secondsIntoSlot = hoursIntoSlot * 3600 + currentMinutes * 60 + currentSeconds;

  // Walk through playlist to find which song is playing
  const totalPlaylistDuration = playlist.reduce((sum, s) => sum + s.duration, 0);
  const positionInPlaylist = secondsIntoSlot % totalPlaylistDuration;

  let elapsed = 0;
  for (let i = 0; i < playlist.length; i++) {
    const song = playlist[i];
    if (elapsed + song.duration > positionInPlaylist) {
      const seekTo = positionInPlaylist - elapsed;
      const nextSong = playlist[(i + 1) % playlist.length];
      const previousSong = i > 0 ? playlist[i - 1] : playlist[playlist.length - 1];

      // Record play (deduplicated)
      if (lastRecordedSongId !== song.id) {
        lastRecordedSongId = song.id;
        try { recordPlay(song.id, slot.name, slot.mood, Math.floor(seekTo)); } catch { /* non-critical */ }
      }

      return buildResponse(song, Math.floor(seekTo), slot, nextSong, previousSong, i, playlist.length);
    }
    elapsed += song.duration;
  }

  // Fallback
  return buildResponse(playlist[0], 0, slot, playlist[1], playlist[playlist.length - 1], 0, playlist.length);
}

function buildResponse(
  song: SongRow,
  seekTo: number,
  slot: typeof slots[0],
  nextSong: SongRow,
  previousSong: SongRow,
  index: number,
  total: number
) {
  return {
    song: { id: song.id, title: song.title, artist: song.artist, mood: song.mood, genre: song.genre },
    seekTo,
    duration: song.duration,
    slot: { name: slot.name, mood: slot.mood, djName: slot.djName, voice: slot.voice },
    nextSong: { id: nextSong.id, title: nextSong.title, artist: nextSong.artist },
    previousSong: { id: previousSong.id, title: previousSong.title, artist: previousSong.artist },
    playlistIndex: index,
    playlistLength: total,
    serverTime: Date.now(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playingSongId = searchParams.get('playing') || undefined;

  const data = getNowPlaying(playingSongId);
  if (!data) {
    return NextResponse.json({ error: 'No songs available' }, { status: 500 });
  }
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
