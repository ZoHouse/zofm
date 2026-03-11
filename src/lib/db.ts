import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'zo-radio.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
    seedSongsIfEmpty(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      mood TEXT NOT NULL,
      genre TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 240,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      play_count INTEGER NOT NULL DEFAULT 0,
      last_played_at TEXT,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id TEXT NOT NULL REFERENCES songs(id),
      slot_name TEXT NOT NULL,
      mood TEXT NOT NULL,
      played_at TEXT NOT NULL DEFAULT (datetime('now')),
      seek_to INTEGER NOT NULL DEFAULT 0,
      listener_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dj_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      song_id TEXT REFERENCES songs(id),
      slot_name TEXT,
      mood TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      weight REAL NOT NULL DEFAULT 1.0
    );

    CREATE TABLE IF NOT EXISTS listener_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_songs_mood ON songs(mood) WHERE enabled = 1;
    CREATE INDEX IF NOT EXISTS idx_play_history_song ON play_history(song_id);
    CREATE INDEX IF NOT EXISTS idx_play_history_played ON play_history(played_at);
    CREATE INDEX IF NOT EXISTS idx_dj_memory_type ON dj_memory(type);
    CREATE INDEX IF NOT EXISTS idx_dj_memory_song ON dj_memory(song_id);
    CREATE INDEX IF NOT EXISTS idx_listener_signals_event ON listener_signals(event);
  `);
}

// --- Song catalog seed data ---
const SEED_SONGS = [
  // ENERGETIC
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

  // CHILL
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

  // FOCUS
  { id: "lTRiuFIWV54", title: "Interstellar Main Theme", artist: "Hans Zimmer", mood: "focus", genre: "soundtrack", duration: 295 },
  { id: "Fe93CLbHjxQ", title: "Time (Inception)", artist: "Hans Zimmer", mood: "focus", genre: "soundtrack", duration: 284 },
  { id: "WDXPJWIgX-o", title: "Nuvole Bianche", artist: "Ludovico Einaudi", mood: "focus", genre: "classical", duration: 348 },
  { id: "kgx4WGK0oNU", title: "Clair de Lune", artist: "Debussy", mood: "focus", genre: "classical", duration: 312 },
  { id: "HuFYqnbVbzY", title: "Cornfield Chase", artist: "Hans Zimmer", mood: "focus", genre: "soundtrack", duration: 128 },
  { id: "7kkRkhAXZGg", title: "Experience", artist: "Ludovico Einaudi", mood: "focus", genre: "classical", duration: 312 },
  { id: "TKfS5zVfGBc", title: "Arrival of the Birds", artist: "The Cinematic Orchestra", mood: "focus", genre: "cinematic", duration: 255 },
  { id: "vjncyiuwwXQ", title: "Gymnop\u00e9die No.1", artist: "Erik Satie", mood: "focus", genre: "classical", duration: 192 },
  { id: "RxabLA7UQ9k", title: "The Theory of Everything", artist: "J\u00f3hann J\u00f3hannsson", mood: "focus", genre: "soundtrack", duration: 193 },

  // PARTY
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
  { id: "FN4ibw_Wp2k", title: "This Is Who I Am", artist: "Monro", mood: "party", genre: "house", duration: 392 },

  // LATE-NIGHT
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

  // ROMANTIC
  { id: "lWA2pjMjpBs", title: "Thinking Out Loud", artist: "Ed Sheeran", mood: "romantic", genre: "pop", duration: 281 },
  { id: "fGx6K90TmCI", title: "A Thousand Years", artist: "Christina Perri", mood: "romantic", genre: "pop", duration: 285 },
  { id: "PIh2xe4jnpk", title: "Crazy in Love", artist: "Beyonc\u00e9 ft. Jay-Z", mood: "romantic", genre: "r&b", duration: 236 },
  { id: "hLQl3WQQoQ0", title: "Someone Like You", artist: "Adele", mood: "romantic", genre: "pop", duration: 285 },
  { id: "elsh3J5lJ6g", title: "Unchained Melody", artist: "Righteous Brothers", mood: "romantic", genre: "classic", duration: 218 },
  { id: "LjhCEhWiKXk", title: "Just the Way You Are", artist: "Bruno Mars", mood: "romantic", genre: "pop", duration: 221 },
  { id: "3JWTaaS7LdU", title: "I Will Always Love You", artist: "Whitney Houston", mood: "romantic", genre: "pop", duration: 273 },
  { id: "JkK8g6FMEXE", title: "I Don't Want to Miss a Thing", artist: "Aerosmith", mood: "romantic", genre: "rock", duration: 298 },
  { id: "WpYeekQkAdc", title: "Everything I Do", artist: "Bryan Adams", mood: "romantic", genre: "rock", duration: 394 },
  { id: "SpSMoBp8awM", title: "I'm Yours", artist: "Jason Mraz", mood: "romantic", genre: "acoustic", duration: 242 },
];

function seedSongsIfEmpty(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as c FROM songs').get() as { c: number };
  if (count.c > 0) return;

  const insert = db.prepare(`
    INSERT INTO songs (id, title, artist, mood, genre, duration)
    VALUES (@id, @title, @artist, @mood, @genre, @duration)
  `);

  const tx = db.transaction(() => {
    for (const song of SEED_SONGS) {
      insert.run(song);
    }
  });

  tx();
}

// --- Query helpers ---

export interface SongRow {
  id: string;
  title: string;
  artist: string;
  mood: string;
  genre: string;
  duration: number;
  play_count: number;
  last_played_at: string | null;
}

export function getSongsByMood(mood: string): SongRow[] {
  return getDb().prepare(
    'SELECT id, title, artist, mood, genre, duration, play_count, last_played_at FROM songs WHERE mood = ? AND enabled = 1'
  ).all(mood) as SongRow[];
}

export function getAllSongs(): SongRow[] {
  return getDb().prepare(
    'SELECT id, title, artist, mood, genre, duration, play_count, last_played_at FROM songs WHERE enabled = 1'
  ).all() as SongRow[];
}

export function recordPlay(songId: string, slotName: string, mood: string, seekTo: number) {
  const db = getDb();
  db.prepare(
    'INSERT INTO play_history (song_id, slot_name, mood, seek_to) VALUES (?, ?, ?, ?)'
  ).run(songId, slotName, mood, seekTo);

  db.prepare(
    "UPDATE songs SET play_count = play_count + 1, last_played_at = datetime('now') WHERE id = ?"
  ).run(songId);
}

export function getRecentPlays(limit: number = 10): Array<{ song_id: string; title: string; artist: string; slot_name: string; played_at: string }> {
  return getDb().prepare(`
    SELECT ph.song_id, s.title, s.artist, ph.slot_name, ph.played_at
    FROM play_history ph
    JOIN songs s ON s.id = ph.song_id
    ORDER BY ph.played_at DESC
    LIMIT ?
  `).all(limit) as Array<{ song_id: string; title: string; artist: string; slot_name: string; played_at: string }>;
}

export function saveDJMemory(type: string, content: string, songId?: string, slotName?: string, mood?: string) {
  getDb().prepare(
    'INSERT INTO dj_memory (type, content, song_id, slot_name, mood) VALUES (?, ?, ?, ?, ?)'
  ).run(type, content, songId || null, slotName || null, mood || null);
}

export function getDJMemories(type: string, limit: number = 5): Array<{ content: string; song_id: string | null; created_at: string }> {
  return getDb().prepare(
    'SELECT content, song_id, created_at FROM dj_memory WHERE type = ? ORDER BY created_at DESC LIMIT ?'
  ).all(type, limit) as Array<{ content: string; song_id: string | null; created_at: string }>;
}

export function getPlayStats(): { total_plays: number; unique_songs: number; top_song: string | null; top_artist: string | null } {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as c FROM play_history').get() as { c: number };
  const unique = db.prepare('SELECT COUNT(DISTINCT song_id) as c FROM play_history').get() as { c: number };
  const top = db.prepare(`
    SELECT s.title, s.artist FROM play_history ph
    JOIN songs s ON s.id = ph.song_id
    GROUP BY ph.song_id ORDER BY COUNT(*) DESC LIMIT 1
  `).get() as { title: string; artist: string } | undefined;

  return {
    total_plays: total.c,
    unique_songs: unique.c,
    top_song: top?.title || null,
    top_artist: top?.artist || null,
  };
}

export function recordListenerSignal(event: string, sessionId?: string, metadata?: Record<string, unknown>) {
  getDb().prepare(
    'INSERT INTO listener_signals (event, session_id, metadata) VALUES (?, ?, ?)'
  ).run(event, sessionId || null, metadata ? JSON.stringify(metadata) : null);
}
