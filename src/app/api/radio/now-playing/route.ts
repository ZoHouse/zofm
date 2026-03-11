import { NextResponse } from 'next/server';

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

// --- Songs catalog (duplicated here to keep API route self-contained) ---
interface SongEntry {
  id: string;
  title: string;
  artist: string;
  mood: string;
  genre: string;
  duration: number; // seconds — approximate
}

// All songs verified embeddable via YouTube oEmbed + yt-dlp
const songs: SongEntry[] = [
  // ENERGETIC — morning energy, get moving, start the day shipping
  { id: "ZbZSe6N_BXs", title: "Happy", artist: "Pharrell Williams", mood: "energetic", genre: "pop", duration: 233 },
  { id: "PT2_F-1esPk", title: "Can't Stop the Feeling", artist: "Justin Timberlake", mood: "energetic", genre: "pop", duration: 236 },
  { id: "OPf0YbXqDm0", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", mood: "energetic", genre: "funk", duration: 270 },
  { id: "JGwWNGJdvx8", title: "Shape of You", artist: "Ed Sheeran", mood: "energetic", genre: "pop", duration: 234 },
  { id: "CevxZvSJLk8", title: "Roar", artist: "Katy Perry", mood: "energetic", genre: "pop", duration: 264 },
  { id: "09R8_2nJtjg", title: "Sugar", artist: "Maroon 5", mood: "energetic", genre: "pop", duration: 235 },
  { id: "iS1g8G_njx8", title: "Cheap Thrills", artist: "Sia ft. Sean Paul", mood: "energetic", genre: "pop", duration: 224 },
  { id: "hT_nvWreIhg", title: "Counting Stars", artist: "OneRepublic", mood: "energetic", genre: "pop-rock", duration: 257 },
  { id: "nSDgHBxUbVQ", title: "On Top of the World", artist: "Imagine Dragons", mood: "energetic", genre: "pop-rock", duration: 192 },
  { id: "fLexgOxsZu0", title: "Tongue Tied", artist: "Grouplove", mood: "energetic", genre: "indie", duration: 199 },
  { id: "y6Sxv-sUYtM", title: "Pumpin Blood", artist: "NONONO", mood: "energetic", genre: "indie-pop", duration: 199 },
  { id: "IPXIgEAGe4U", title: "Dog Days Are Over", artist: "Florence + The Machine", mood: "energetic", genre: "indie-rock", duration: 247 },
  { id: "UxeW1cdHBYg", title: "Nadlan (Remix)", artist: "Loco Hot", mood: "energetic", genre: "electronic", duration: 385 },
  { id: "xXEAP82AL9g", title: "Im Ani Eshma", artist: "Release", mood: "energetic", genre: "electronic", duration: 171 },
  { id: "Ji7ZL_zL90c", title: "Mr. President", artist: "Shagy", mood: "energetic", genre: "electronic", duration: 303 },
  { id: "lmkAI7Dj22Y", title: "Take a Brake", artist: "Shagy", mood: "energetic", genre: "house", duration: 336 },

  // CHILL — common room, afternoon wind-down, coffee + conversation
  { id: "450p7goxZqg", title: "Perfect", artist: "Ed Sheeran", mood: "chill", genre: "pop", duration: 263 },
  { id: "60ItHLz5WEA", title: "All of Me", artist: "John Legend", mood: "chill", genre: "pop", duration: 269 },
  { id: "RBumgq5yVrA", title: "Photograph", artist: "Ed Sheeran", mood: "chill", genre: "pop", duration: 258 },
  { id: "nfWlot6h_JM", title: "Say You Won't Let Go", artist: "James Arthur", mood: "chill", genre: "pop", duration: 211 },
  { id: "7maJOI3QMu0", title: "Stay With Me", artist: "Sam Smith", mood: "chill", genre: "pop", duration: 172 },
  { id: "pBkHHoOIIn8", title: "Let Her Go", artist: "Passenger", mood: "chill", genre: "folk", duration: 253 },
  { id: "RsEZmictANA", title: "Ho Hey", artist: "The Lumineers", mood: "chill", genre: "folk-rock", duration: 163 },
  { id: "lp-EO5I60KA", title: "Riptide", artist: "Vance Joy", mood: "chill", genre: "indie-folk", duration: 204 },
  { id: "hXI8RQYC36Q", title: "Put Your Records On", artist: "Corinne Bailey Rae", mood: "chill", genre: "soul", duration: 225 },
  { id: "k4V3Mo61fJM", title: "Better Together", artist: "Jack Johnson", mood: "chill", genre: "acoustic", duration: 207 },

  // FOCUS — deep work, build sprints, flow state
  { id: "lTRiuFIWV54", title: "Interstellar Main Theme", artist: "Hans Zimmer", mood: "focus", genre: "soundtrack", duration: 295 },
  { id: "Fe93CLbHjxQ", title: "Time (Inception)", artist: "Hans Zimmer", mood: "focus", genre: "soundtrack", duration: 284 },
  { id: "WDXPJWIgX-o", title: "Nuvole Bianche", artist: "Ludovico Einaudi", mood: "focus", genre: "classical", duration: 348 },
  { id: "kgx4WGK0oNU", title: "Clair de Lune", artist: "Debussy", mood: "focus", genre: "classical", duration: 312 },
  { id: "HuFYqnbVbzY", title: "Cornfield Chase", artist: "Hans Zimmer", mood: "focus", genre: "soundtrack", duration: 128 },
  { id: "7kkRkhAXZGg", title: "Experience", artist: "Ludovico Einaudi", mood: "focus", genre: "classical", duration: 312 },
  { id: "TKfS5zVfGBc", title: "Arrival of the Birds", artist: "The Cinematic Orchestra", mood: "focus", genre: "cinematic", duration: 255 },
  { id: "vjncyiuwwXQ", title: "Gymnopédie No.1", artist: "Erik Satie", mood: "focus", genre: "classical", duration: 192 },
  { id: "RxabLA7UQ9k", title: "The Theory of Everything", artist: "Jóhann Jóhannsson", mood: "focus", genre: "soundtrack", duration: 193 },

  // PARTY — evening energy, house events, communal dinners turning into dance floors
  { id: "kTJczUoc26U", title: "Lean On", artist: "Major Lazer & DJ Snake", mood: "party", genre: "edm", duration: 176 },
  { id: "IcrbM1l_BoI", title: "Closer", artist: "The Chainsmokers ft. Halsey", mood: "party", genre: "edm", duration: 245 },
  { id: "fRh_vgS2dFE", title: "Sorry", artist: "Justin Bieber", mood: "party", genre: "pop", duration: 200 },
  { id: "bx1Bh8ZvH84", title: "Hymn for the Weekend", artist: "Coldplay", mood: "party", genre: "alt-pop", duration: 258 },
  { id: "ru0K8uYEZWw", title: "Thunder", artist: "Imagine Dragons", mood: "party", genre: "pop-rock", duration: 187 },
  { id: "nfs8NYg7yQM", title: "HUMBLE.", artist: "Kendrick Lamar", mood: "party", genre: "hip-hop", duration: 177 },
  { id: "2vjPBrBU-TM", title: "Savage Love", artist: "Jawsh 685 & Jason Derulo", mood: "party", genre: "pop", duration: 171 },
  { id: "kOkQ4T5WO9E", title: "Wake Me Up", artist: "Avicii", mood: "party", genre: "edm", duration: 247 },
  { id: "_ovdm2yX4MA", title: "Levels", artist: "Avicii", mood: "party", genre: "edm", duration: 203 },
  { id: "gCYcHz2k5x0", title: "Animals", artist: "Martin Garrix", mood: "party", genre: "edm", duration: 305 },
  { id: "SiMHTK15Pik", title: "The Nights", artist: "Avicii", mood: "party", genre: "edm", duration: 177 },
  { id: "cafHoQjQr2U", title: "Do De Te (HIGHLITE Remix)", artist: "HIGHLITE", mood: "party", genre: "house", duration: 384 },
  { id: "xezlibVAW5Y", title: "Bonita", artist: "Jacob", mood: "party", genre: "house", duration: 335 },
  { id: "7a2mAVQUZ0o", title: "Loving Club", artist: "Shagy", mood: "party", genre: "house", duration: 330 },
  { id: "wIAE3q73wrc", title: "Club 04", artist: "Adam Ten", mood: "party", genre: "house", duration: 356 },
  { id: "5AdUARmaMdQ", title: "Who I Am", artist: "Rebrn", mood: "party", genre: "house", duration: 355 },
  { id: "WVqo9SKNyds", title: "It's On", artist: "Monro", mood: "party", genre: "house", duration: 315 },
  { id: "dUbnvxB7WtA", title: "Let Your Body Fly", artist: "Maison Royale", mood: "party", genre: "house", duration: 205 },
  { id: "oSPT27XyY1U", title: "Kill The Noise", artist: "Kill The Noise & Feed Me", mood: "party", genre: "electronic", duration: 202 },
  { id: "FN4ibw_Wp2k", title: "This Is Who I Am", artist: "Monro", mood: "party", genre: "house", duration: 392 },

  // LATE-NIGHT — post-midnight, hacking sessions, 3am kitchen conversations
  { id: "4fndeDfaWCg", title: "Blinding Lights", artist: "The Weeknd", mood: "late-night", genre: "synth-pop", duration: 200 },
  { id: "RvA3q0ZU-NQ", title: "Starboy", artist: "The Weeknd ft. Daft Punk", mood: "late-night", genre: "synth-pop", duration: 230 },
  { id: "fJ9rUzIMcZQ", title: "Bohemian Rhapsody", artist: "Queen", mood: "late-night", genre: "rock", duration: 355 },
  { id: "FTQbiNvZqaY", title: "Africa", artist: "Toto", mood: "late-night", genre: "rock", duration: 275 },
  { id: "hTWKbfoikeg", title: "Smells Like Teen Spirit", artist: "Nirvana", mood: "late-night", genre: "grunge", duration: 301 },
  { id: "YnwfTHpnGLY", title: "Radioactive", artist: "Imagine Dragons", mood: "late-night", genre: "alt-rock", duration: 187 },
  { id: "1w7OgIMMRc4", title: "Sweet Child O' Mine", artist: "Guns N' Roses", mood: "late-night", genre: "rock", duration: 356 },
  { id: "btPJPFnesV4", title: "Eye of the Tiger", artist: "Survivor", mood: "late-night", genre: "rock", duration: 245 },
  { id: "qQzdAsjWGPg", title: "My Way", artist: "Frank Sinatra", mood: "late-night", genre: "classic", duration: 277 },
  { id: "QkF3oxziUI4", title: "Stairway to Heaven", artist: "Led Zeppelin", mood: "late-night", genre: "rock", duration: 482 },
  { id: "KQ6zr6kCPj8", title: "Life on Mars?", artist: "David Bowie", mood: "late-night", genre: "art-rock", duration: 235 },
  { id: "k2C5TjS2sh4", title: "A-Punk", artist: "Vampire Weekend", mood: "late-night", genre: "indie", duration: 137 },
  { id: "q-hEVTskFs8", title: "Ananas", artist: "Jacob", mood: "late-night", genre: "electronic", duration: 355 },
  { id: "3KgqV4E-E68", title: "Tetris", artist: "Rebrn", mood: "late-night", genre: "electronic", duration: 364 },
  { id: "gef0MASMgtM", title: "Back in 1995", artist: "Morgi", mood: "late-night", genre: "electronic", duration: 410 },
  { id: "e2xRZHHjQwE", title: "Look Back", artist: "Jacob", mood: "late-night", genre: "electronic", duration: 370 },
  { id: "d_9Rjw2SnlM", title: "Gidafi Na (Red Axes Edit)", artist: "Red Axes", mood: "late-night", genre: "electronic", duration: 457 },
  { id: "QQk7CVCImEQ", title: "One Night in TLV", artist: "Monro", mood: "late-night", genre: "electronic", duration: 410 },
  { id: "Q5Cz6UVCg7M", title: "Spaceship Eyes", artist: "Lali", mood: "late-night", genre: "electronic", duration: 378 },
  { id: "01Skgv0kk7g", title: "Gaia", artist: "MANNA", mood: "late-night", genre: "electronic", duration: 444 },
  { id: "ydEIAO2edNc", title: "Technique", artist: "Morgi", mood: "late-night", genre: "electronic", duration: 360 },
  { id: "CrXdgPMjgzk", title: "Warning", artist: "Jacob", mood: "late-night", genre: "electronic", duration: 372 },
  { id: "t_N_LuB4XYo", title: "Connected", artist: "Alexey Union", mood: "late-night", genre: "electronic", duration: 447 },

  // ROMANTIC — rooftop hours, pre-dawn, deep conversations becoming deeper
  { id: "lWA2pjMjpBs", title: "Thinking Out Loud", artist: "Ed Sheeran", mood: "romantic", genre: "pop", duration: 281 },
  { id: "fGx6K90TmCI", title: "A Thousand Years", artist: "Christina Perri", mood: "romantic", genre: "pop", duration: 285 },
  { id: "PIh2xe4jnpk", title: "Crazy in Love", artist: "Beyoncé ft. Jay-Z", mood: "romantic", genre: "r&b", duration: 236 },
  { id: "hLQl3WQQoQ0", title: "Someone Like You", artist: "Adele", mood: "romantic", genre: "pop", duration: 285 },
  { id: "elsh3J5lJ6g", title: "Unchained Melody", artist: "Righteous Brothers", mood: "romantic", genre: "classic", duration: 218 },
  { id: "LjhCEhWiKXk", title: "Just the Way You Are", artist: "Bruno Mars", mood: "romantic", genre: "pop", duration: 221 },
  { id: "3JWTaaS7LdU", title: "I Will Always Love You", artist: "Whitney Houston", mood: "romantic", genre: "pop", duration: 273 },
  { id: "JkK8g6FMEXE", title: "I Don't Want to Miss a Thing", artist: "Aerosmith", mood: "romantic", genre: "rock", duration: 298 },
  { id: "WpYeekQkAdc", title: "Everything I Do", artist: "Bryan Adams", mood: "romantic", genre: "rock", duration: 394 },
  { id: "SpSMoBp8awM", title: "I'm Yours", artist: "Jason Mraz", mood: "romantic", genre: "acoustic", duration: 242 },
];

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

// --- Core: compute what's playing right now ---

function getNowPlaying() {
  const slot = getCurrentSlot();
  const moodSongs = songs.filter(s => s.mood === slot.mood);

  // Deterministic shuffle for today + this slot
  const seed = getDaySeed() + slot.startHour;
  const playlist = seededShuffle(moodSongs, seed);

  // Calculate how far into this slot we are (in seconds)
  const ist = getISTDate();
  const slotStartHour = slot.startHour;
  const currentHour = ist.getHours();
  const currentMinutes = ist.getMinutes();
  const currentSeconds = ist.getSeconds();

  // Handle midnight wrap: if slot starts at 22 and current is 1, adjust
  let hoursIntoSlot = currentHour - slotStartHour;
  if (hoursIntoSlot < 0) hoursIntoSlot += 24;

  const secondsIntoSlot = hoursIntoSlot * 3600 + currentMinutes * 60 + currentSeconds;

  // Walk through playlist to find which song is playing
  // Songs loop within the slot, so we mod by total playlist duration
  const totalPlaylistDuration = playlist.reduce((sum, s) => sum + s.duration, 0);
  const positionInPlaylist = secondsIntoSlot % totalPlaylistDuration;

  let elapsed = 0;
  for (let i = 0; i < playlist.length; i++) {
    const song = playlist[i];
    if (elapsed + song.duration > positionInPlaylist) {
      const seekTo = positionInPlaylist - elapsed;
      const nextSong = playlist[(i + 1) % playlist.length];
      const previousSong = i > 0 ? playlist[i - 1] : playlist[playlist.length - 1];
      return {
        song: { id: song.id, title: song.title, artist: song.artist, mood: song.mood, genre: song.genre },
        seekTo: Math.floor(seekTo),
        duration: song.duration,
        slot: { name: slot.name, mood: slot.mood, djName: slot.djName, voice: slot.voice },
        nextSong: { id: nextSong.id, title: nextSong.title, artist: nextSong.artist },
        previousSong: { id: previousSong.id, title: previousSong.title, artist: previousSong.artist },
        playlistIndex: i,
        playlistLength: playlist.length,
        serverTime: Date.now(),
      };
    }
    elapsed += song.duration;
  }

  // Fallback (shouldn't happen)
  return {
    song: { id: playlist[0].id, title: playlist[0].title, artist: playlist[0].artist, mood: playlist[0].mood, genre: playlist[0].genre },
    seekTo: 0,
    duration: playlist[0].duration,
    slot: { name: slot.name, mood: slot.mood, djName: slot.djName, voice: slot.voice },
    nextSong: { id: playlist[1].id, title: playlist[1].title, artist: playlist[1].artist },
    previousSong: { id: playlist[playlist.length - 1].id, title: playlist[playlist.length - 1].title, artist: playlist[playlist.length - 1].artist },
    playlistIndex: 0,
    playlistLength: playlist.length,
    serverTime: Date.now(),
  };
}

export async function GET() {
  const data = getNowPlaying();
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
