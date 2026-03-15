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

    CREATE TABLE IF NOT EXISTS dj_clips (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL,
      next_song_id TEXT NOT NULL,
      slot_name TEXT NOT NULL,
      mood TEXT NOT NULL,
      script TEXT NOT NULL,
      audio BLOB NOT NULL,
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_dj_clips_transition ON dj_clips(song_id, next_song_id);
  `);
}

// --- Song catalog seed data (durations verified against YouTube via yt-dlp) ---
const SEED_SONGS = [
  // ENERGETIC
  { id: "xXEAP82AL9g", title: "Im Ani Eshma", artist: "Release", mood: "energetic", genre: "electronic", duration: 171 },
  { id: "Ji7ZL_zL90c", title: "Mr. President", artist: "Shagy", mood: "energetic", genre: "electronic", duration: 303 },
  { id: "UxeW1cdHBYg", title: "Nadlan (Remix)", artist: "Loco Hot", mood: "energetic", genre: "electronic", duration: 384 },
  { id: "OPf0YbXqDm0", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", mood: "energetic", genre: "funk", duration: 270 },
  { id: "lmkAI7Dj22Y", title: "Take a Brake", artist: "Shagy", mood: "energetic", genre: "house", duration: 335 },
  { id: "fLexgOxsZu0", title: "Tongue Tied", artist: "Grouplove", mood: "energetic", genre: "indie", duration: 199 },
  { id: "y6Sxv-sUYtM", title: "Pumpin Blood", artist: "NONONO", mood: "energetic", genre: "indie-pop", duration: 247 },
  { id: "IPXIgEAGe4U", title: "Dog Days Are Over", artist: "Florence + The Machine", mood: "energetic", genre: "indie-rock", duration: 197 },
  { id: "PT2_F-1esPk", title: "Can't Stop the Feeling", artist: "Justin Timberlake", mood: "energetic", genre: "pop", duration: 262 },
  { id: "iS1g8G_njx8", title: "Cheap Thrills", artist: "Sia ft. Sean Paul", mood: "energetic", genre: "pop", duration: 207 },
  { id: "ZbZSe6N_BXs", title: "Happy", artist: "Pharrell Williams", mood: "energetic", genre: "pop", duration: 241 },
  { id: "CevxZvSJLk8", title: "Roar", artist: "Katy Perry", mood: "energetic", genre: "pop", duration: 269 },
  { id: "JGwWNGJdvx8", title: "Shape of You", artist: "Ed Sheeran", mood: "energetic", genre: "pop", duration: 263 },
  { id: "09R8_2nJtjg", title: "Sugar", artist: "Maroon 5", mood: "energetic", genre: "pop", duration: 301 },
  { id: "hT_nvWreIhg", title: "Counting Stars", artist: "OneRepublic", mood: "energetic", genre: "pop-rock", duration: 283 },
  { id: "nSDgHBxUbVQ", title: "On Top of the World", artist: "Imagine Dragons", mood: "energetic", genre: "pop-rock", duration: 274 },

  // CHILL — melodic house, downtempo, organic
  { id: "k4V3Mo61fJM", title: "Better Together", artist: "Jack Johnson", mood: "chill", genre: "acoustic", duration: 294 },
  { id: "WF34N4gJAKE", title: "Cirrus", artist: "Bonobo", mood: "chill", genre: "downtempo", duration: 202 },
  { id: "S0Q4gqBUs7c", title: "Kerala", artist: "Bonobo", mood: "chill", genre: "downtempo", duration: 243 },
  { id: "ebzEEEdjHj0", title: "No Reason", artist: "Bonobo ft. Nick Murphy", mood: "chill", genre: "downtempo", duration: 244 },
  { id: "FwXUxPYiwUc", title: "Bloom", artist: "HVOB", mood: "chill", genre: "electronic", duration: 279 },
  { id: "FwWdxivYaac", title: "Home", artist: "HVOB", mood: "chill", genre: "electronic", duration: 246 },
  { id: "pBkHHoOIIn8", title: "Let Her Go", artist: "Passenger", mood: "chill", genre: "folk", duration: 170 },
  { id: "RsEZmictANA", title: "Ho Hey", artist: "The Lumineers", mood: "chill", genre: "folk-rock", duration: 253 },
  { id: "GmDDzShO468", title: "Carry On", artist: "Jan Blomqvist", mood: "chill", genre: "indie-electronic", duration: 230 },
  { id: "jEAdonIAXlk", title: "Maybe Not", artist: "Jan Blomqvist", mood: "chill", genre: "indie-electronic", duration: 295 },
  { id: "lp-EO5I60KA", title: "Riptide", artist: "Vance Joy", mood: "chill", genre: "indie-folk", duration: 289 },
  { id: "LFdLeS-zKFE", title: "I Don't Wanna Leave", artist: "RÜFÜS DU SOL", mood: "chill", genre: "melodic-house", duration: 270 },
  { id: "Tx9zMFodNtA", title: "Innerbloom", artist: "RÜFÜS DU SOL", mood: "chill", genre: "melodic-house", duration: 578 },
  { id: "-ge8lQfig9Y", title: "No Place", artist: "RÜFÜS DU SOL", mood: "chill", genre: "melodic-house", duration: 254 },
  { id: "v8H7O-1RBKY", title: "Underwater", artist: "RÜFÜS DU SOL", mood: "chill", genre: "melodic-house", duration: 348 },
  { id: "7jHTYHQrNwc", title: "Flying Away With You", artist: "WhoMadeWho & Tripolism", mood: "chill", genre: "melodic-techno", duration: 329 },
  { id: "smwt39Qf_90", title: "Montserrat (ARTBAT Edit)", artist: "WhoMadeWho", mood: "chill", genre: "melodic-techno", duration: 488 },
  { id: "60ItHLz5WEA", title: "All of Me", artist: "John Legend", mood: "chill", genre: "pop", duration: 213 },
  { id: "450p7goxZqg", title: "Perfect", artist: "Ed Sheeran", mood: "chill", genre: "pop", duration: 307 },
  { id: "RBumgq5yVrA", title: "Photograph", artist: "Ed Sheeran", mood: "chill", genre: "pop", duration: 254 },
  { id: "nfWlot6h_JM", title: "Say You Won't Let Go", artist: "James Arthur", mood: "chill", genre: "pop", duration: 242 },
  { id: "7maJOI3QMu0", title: "Stay With Me", artist: "Sam Smith", mood: "chill", genre: "pop", duration: 210 },
  { id: "hXI8RQYC36Q", title: "Put Your Records On", artist: "Corinne Bailey Rae", mood: "chill", genre: "soul", duration: 227 },

  // FOCUS — ambient, neo-classical, deep electronic
  { id: "9kuNshckRIU", title: "Epoch", artist: "Tycho", mood: "focus", genre: "ambient", duration: 345 },
  { id: "EtI7f3Rwqkw", title: "Horizon", artist: "Tycho", mood: "focus", genre: "ambient", duration: 249 },
  { id: "TKfS5zVfGBc", title: "Arrival of the Birds", artist: "The Cinematic Orchestra", mood: "focus", genre: "cinematic", duration: 519 },
  { id: "WNcsUNKlAKw", title: "Clair de Lune", artist: "Debussy", mood: "focus", genre: "classical", duration: 314 },
  { id: "1e9B31FLT-s", title: "Experience", artist: "Ludovico Einaudi", mood: "focus", genre: "classical", duration: 316 },
  { id: "vjncyiuwwXQ", title: "Gymnopédie No.1", artist: "Erik Satie", mood: "focus", genre: "classical", duration: 229 },
  { id: "sR2W2scFS4Y", title: "Nuvole Bianche", artist: "Ludovico Einaudi", mood: "focus", genre: "classical", duration: 363 },
  { id: "MAmpBFA988k", title: "Blurred (Bonobo Remix)", artist: "Kiasmos", mood: "focus", genre: "downtempo", duration: 339 },
  { id: "dquO_by8GI8", title: "Migration", artist: "Bonobo", mood: "focus", genre: "downtempo", duration: 327 },
  { id: "d89UrIkZvOM", title: "Lush", artist: "Four Tet", mood: "focus", genre: "electronic", duration: 313 },
  { id: "aVTalm2VjDc", title: "Beyond Beliefs", artist: "Ben Böhmer", mood: "focus", genre: "melodic-house", duration: 314 },
  { id: "xF5PzY4b3eQ", title: "Breathing", artist: "Ben Böhmer, Nils Hoffmann & Malou", mood: "focus", genre: "melodic-house", duration: 383 },
  { id: "HbsbieBog1c", title: "Blurred", artist: "Kiasmos", mood: "focus", genre: "minimal-techno", duration: 311 },
  { id: "0kYc55bXJFI", title: "Near Light", artist: "Ólafur Arnalds", mood: "focus", genre: "neo-classical", duration: 209 },
  { id: "wEj7xYyj9n4", title: "Particles", artist: "Ólafur Arnalds ft. Nanna", mood: "focus", genre: "neo-classical", duration: 237 },
  { id: "dIwwjy4slI8", title: "Says", artist: "Nils Frahm", mood: "focus", genre: "neo-classical", duration: 499 },
  { id: "Wk02R4UNE3k", title: "Them", artist: "Nils Frahm", mood: "focus", genre: "neo-classical", duration: 241 },
  { id: "xpZgtFhDbss", title: "saman", artist: "Ólafur Arnalds", mood: "focus", genre: "neo-classical", duration: 155 },

  // PARTY — house, techno, electronic
  { id: "bx1Bh8ZvH84", title: "Hymn for the Weekend", artist: "Coldplay", mood: "party", genre: "alt-pop", duration: 278 },
  { id: "gCYcHz2k5x0", title: "Animals", artist: "Martin Garrix", mood: "party", genre: "edm", duration: 192 },
  { id: "IcrbM1l_BoI", title: "Closer", artist: "The Chainsmokers ft. Halsey", mood: "party", genre: "edm", duration: 273 },
  { id: "kTJczUoc26U", title: "Lean On", artist: "Major Lazer & DJ Snake", mood: "party", genre: "edm", duration: 158 },
  { id: "_ovdm2yX4MA", title: "Levels", artist: "Avicii", mood: "party", genre: "edm", duration: 198 },
  { id: "UtF6Jej8yb4", title: "The Nights", artist: "Avicii", mood: "party", genre: "edm", duration: 191 },
  { id: "kOkQ4T5WO9E", title: "Wake Me Up", artist: "Avicii", mood: "party", genre: "edm", duration: 239 },
  { id: "3NPxqXMZq7o", title: "Bad Kingdom", artist: "Moderat", mood: "party", genre: "electronic", duration: 266 },
  { id: "RpjhBgbQH_g", title: "Cool Melt", artist: "HVOB", mood: "party", genre: "electronic", duration: 383 },
  { id: "cJwsNUoazUg", title: "Reminder", artist: "Moderat", mood: "party", genre: "electronic", duration: 206 },
  { id: "MXlAU-HT4Os", title: "Torrid Soul", artist: "HVOB & Winston Marshall", mood: "party", genre: "electronic", duration: 423 },
  { id: "nfs8NYg7yQM", title: "HUMBLE.", artist: "Kendrick Lamar", mood: "party", genre: "hip-hop", duration: 232 },
  { id: "xezlibVAW5Y", title: "Bonita", artist: "Jacob", mood: "party", genre: "house", duration: 334 },
  { id: "wIAE3q73wrc", title: "Club 04", artist: "Adam Ten", mood: "party", genre: "house", duration: 355 },
  { id: "cafHoQjQr2U", title: "Do De Te (HIGHLITE Remix)", artist: "HIGHLITE", mood: "party", genre: "house", duration: 384 },
  { id: "WVqo9SKNyds", title: "It's On", artist: "Monro", mood: "party", genre: "house", duration: 315 },
  { id: "dUbnvxB7WtA", title: "Let Your Body Fly", artist: "Maison Royale", mood: "party", genre: "house", duration: 205 },
  { id: "7a2mAVQUZ0o", title: "Loving Club", artist: "Shagy", mood: "party", genre: "house", duration: 330 },
  { id: "FN4ibw_Wp2k", title: "This Is Who I Am", artist: "Monro", mood: "party", genre: "house", duration: 391 },
  { id: "5AdUARmaMdQ", title: "Who I Am", artist: "Rebrn", mood: "party", genre: "house", duration: 354 },
  { id: "Pnsxy1zAT1Y", title: "Algorithm", artist: "Jan Blomqvist", mood: "party", genre: "indie-electronic", duration: 247 },
  { id: "eGHve2P4LRM", title: "Sirens", artist: "Monolink", mood: "party", genre: "indie-electronic", duration: 394 },
  { id: "UzPRso975PM", title: "Father Ocean (Ben Böhmer Remix)", artist: "Monolink", mood: "party", genre: "melodic-house", duration: 355 },
  { id: "6MfdjuzcPJA", title: "Closer", artist: "ARTBAT ft. WhoMadeWho", mood: "party", genre: "melodic-techno", duration: 461 },
  { id: "MpbZDxx44qE", title: "Consciousness", artist: "Anyma & Chris Avantgarde", mood: "party", genre: "melodic-techno", duration: 274 },
  { id: "Y6o2HmKFCUw", title: "Eternity", artist: "Anyma & Chris Avantgarde", mood: "party", genre: "melodic-techno", duration: 321 },
  { id: "4oYrQt_zRFg", title: "Miracle", artist: "Adriatique & WhoMadeWho", mood: "party", genre: "melodic-techno", duration: 303 },
  { id: "yw8ldqvzE-M", title: "Otherside (Fideles Remix)", artist: "Monolink", mood: "party", genre: "melodic-techno", duration: 409 },
  { id: "Lo0ELoepTCM", title: "Return To Oz (ARTBAT Remix)", artist: "Monolink", mood: "party", genre: "melodic-techno", duration: 480 },
  { id: "2vjPBrBU-TM", title: "Savage Love", artist: "Jawsh 685 & Jason Derulo", mood: "party", genre: "pop", duration: 231 },
  { id: "fRh_vgS2dFE", title: "Sorry", artist: "Justin Bieber", mood: "party", genre: "pop", duration: 205 },
  { id: "ru0K8uYEZWw", title: "Thunder", artist: "Imagine Dragons", mood: "party", genre: "pop-rock", duration: 286 },

  // LATE-NIGHT — deep electronic, melodic techno, DJ sets
  { id: "4fndeDfaWCg", title: "Blinding Lights", artist: "The Weeknd", mood: "late-night", genre: "synth-pop", duration: 219 },
  { id: "RvA3q0ZU-NQ", title: "Starboy", artist: "The Weeknd ft. Daft Punk", mood: "late-night", genre: "synth-pop", duration: 215 },
  { id: "YnwfTHpnGLY", title: "Radioactive", artist: "Imagine Dragons", mood: "late-night", genre: "alt-rock", duration: 501 },
  { id: "KQ6zr6kCPj8", title: "Life on Mars?", artist: "David Bowie", mood: "late-night", genre: "art-rock", duration: 376 },
  { id: "qQzdAsjWGPg", title: "My Way", artist: "Frank Sinatra", mood: "late-night", genre: "classic", duration: 276 },
  { id: "hTWKbfoikeg", title: "Smells Like Teen Spirit", artist: "Nirvana", mood: "late-night", genre: "grunge", duration: 278 },
  { id: "FTQbiNvZqaY", title: "Africa", artist: "Toto", mood: "late-night", genre: "rock", duration: 271 },
  { id: "fJ9rUzIMcZQ", title: "Bohemian Rhapsody", artist: "Queen", mood: "late-night", genre: "rock", duration: 359 },
  { id: "btPJPFnesV4", title: "Eye of the Tiger", artist: "Survivor", mood: "late-night", genre: "rock", duration: 245 },
  { id: "QkF3oxziUI4", title: "Stairway to Heaven", artist: "Led Zeppelin", mood: "late-night", genre: "rock", duration: 483 },
  { id: "1w7OgIMMRc4", title: "Sweet Child O' Mine", artist: "Guns N' Roses", mood: "late-night", genre: "rock", duration: 303 },
  { id: "k2C5TjS2sh4", title: "A-Punk", artist: "Vampire Weekend", mood: "late-night", genre: "indie", duration: 256 },
  { id: "q-hEVTskFs8", title: "Ananas", artist: "Jacob", mood: "late-night", genre: "electronic", duration: 354 },
  { id: "YsBGIhaRBoc", title: "Azrael", artist: "HVOB", mood: "late-night", genre: "electronic", duration: 455 },
  { id: "gef0MASMgtM", title: "Back in 1995", artist: "Morgi", mood: "late-night", genre: "electronic", duration: 409 },
  { id: "t_N_LuB4XYo", title: "Connected", artist: "Alexey Union", mood: "late-night", genre: "electronic", duration: 447 },
  { id: "8VVNaVUA-3s", title: "Deus", artist: "HVOB & Winston Marshall", mood: "late-night", genre: "electronic", duration: 424 },
  { id: "KXntamEu1tk", title: "Dogs", artist: "HVOB", mood: "late-night", genre: "electronic", duration: 336 },
  { id: "01Skgv0kk7g", title: "Gaia", artist: "MANNA", mood: "late-night", genre: "electronic", duration: 444 },
  { id: "dtP7xM05TsI", title: "Gidafi Na (Red Axes Edit)", artist: "Red Axes", mood: "late-night", genre: "electronic", duration: 457 },
  { id: "e2xRZHHjQwE", title: "Look Back", artist: "Jacob", mood: "late-night", genre: "electronic", duration: 370 },
  { id: "QQk7CVCImEQ", title: "One Night in TLV", artist: "Monro", mood: "late-night", genre: "electronic", duration: 409 },
  { id: "R9a2xZaINN0", title: "Parallel Jalebi", artist: "Four Tet", mood: "late-night", genre: "electronic", duration: 235 },
  { id: "Q5Cz6UVCg7M", title: "Spaceship Eyes", artist: "Lali", mood: "late-night", genre: "electronic", duration: 378 },
  { id: "ydEIAO2edNc", title: "Technique", artist: "Morgi", mood: "late-night", genre: "electronic", duration: 360 },
  { id: "3KgqV4E-E68", title: "Tetris", artist: "Rebrn", mood: "late-night", genre: "electronic", duration: 364 },
  { id: "v2vXMI6Xj-g", title: "The Blame Game", artist: "HVOB & Winston Marshall", mood: "late-night", genre: "electronic", duration: 354 },
  { id: "cbiBFSgci9o", title: "Turn A Rope Round Its Axis", artist: "HVOB", mood: "late-night", genre: "electronic", duration: 393 },
  { id: "CrXdgPMjgzk", title: "Warning", artist: "Jacob", mood: "late-night", genre: "electronic", duration: 372 },
  { id: "GM-xUu3VRsU", title: "Window", artist: "HVOB", mood: "late-night", genre: "electronic", duration: 386 },
  // Melodic techno
  { id: "FoedhLH5PDE", title: "Endless Journey", artist: "Tale Of Us", mood: "late-night", genre: "melodic-techno", duration: 369 },
  { id: "8mh98ALPIVA", title: "Oltre la vita", artist: "Tale Of Us", mood: "late-night", genre: "melodic-techno", duration: 481 },
  { id: "-1wFkrrH1Fc", title: "Powers of Ten (Live at Cercle)", artist: "Stephan Bodzin", mood: "late-night", genre: "melodic-techno", duration: 251 },
  { id: "xBZdrqnz0jI", title: "Ricordi", artist: "Tale Of Us", mood: "late-night", genre: "melodic-techno", duration: 440 },
  // DJ sets — Robot Heart, Cercle, Boiler Room
  { id: "bk6Xst6euQk", title: "Boiler Room Tulum", artist: "Solomun", mood: "late-night", genre: "dj-set", duration: 7231 },
  { id: "X13beDr0fZY", title: "Boiler Room Vienna", artist: "HVOB", mood: "late-night", genre: "dj-set", duration: 4407 },
  { id: "BDwAlto-NKU", title: "Cercle - Abu Simbel, Egypt", artist: "WhoMadeWho", mood: "late-night", genre: "dj-set", duration: 6097 },
  { id: "w4LRUBFy3pc", title: "Cercle - Luxor, Egypt", artist: "Adriatique", mood: "late-night", genre: "dj-set", duration: 8417 },
  { id: "xF_QkfZI1mM", title: "Cercle - Piz Gloria, Switzerland", artist: "Stephan Bodzin", mood: "late-night", genre: "dj-set", duration: 6213 },
  { id: "QHDRRxKlimY", title: "Cercle - Théâtre Antique d'Orange", artist: "Solomun", mood: "late-night", genre: "dj-set", duration: 6939 },
  { id: "w1ElkNNsfm8", title: "Cercle - Tossa de Mar, Spain", artist: "Jan Blomqvist", mood: "late-night", genre: "dj-set", duration: 5342 },
  { id: "XxSmY7VNaCk", title: "Live at Cercle - Careyes, Mexico", artist: "HVOB", mood: "late-night", genre: "dj-set", duration: 6008 },
  { id: "IvwS6BYjHG0", title: "Mayan Warrior - Burning Man 2018", artist: "Monolink", mood: "late-night", genre: "dj-set", duration: 4507 },
  { id: "eQ-OVsdK-hM", title: "Mayan Warrior - Burning Man 2024", artist: "RÜFÜS DU SOL", mood: "late-night", genre: "dj-set", duration: 6318 },
  { id: "Kp1H1_O_qCw", title: "Robot Heart - Burning Man 2016", artist: "HVOB", mood: "late-night", genre: "dj-set", duration: 5441 },
  { id: "syfZ-rEsC3o", title: "Robot Heart - Burning Man 2024", artist: "Anyma", mood: "late-night", genre: "dj-set", duration: 4045 },
  { id: "0F6KyA4g71g", title: "Robot Heart - Burning Man 2024", artist: "DJ Tennis B2B Bonobo", mood: "late-night", genre: "dj-set", duration: 7016 },

  // ROMANTIC — deep, intimate, warm
  { id: "SpSMoBp8awM", title: "I'm Yours", artist: "Jason Mraz", mood: "romantic", genre: "acoustic", duration: 175 },
  { id: "elsh3J5lJ6g", title: "Unchained Melody", artist: "Righteous Brothers", mood: "romantic", genre: "classic", duration: 236 },
  { id: "mAmomrJ19yU", title: "Muted Mind", artist: "Jan Blomqvist", mood: "romantic", genre: "indie-electronic", duration: 244 },
  { id: "fh-LJdvs1Ig", title: "Abu Simbel (Live)", artist: "WhoMadeWho & Rampa", mood: "romantic", genre: "melodic-house", duration: 488 },
  { id: "CARHyGAsv6Y", title: "Brightest Lights", artist: "Lane 8 ft. POLIÇA", mood: "romantic", genre: "melodic-house", duration: 413 },
  { id: "DN7iSQrP1sU", title: "Shooting Arrows", artist: "Lane 8 ft. POLIÇA", mood: "romantic", genre: "melodic-house", duration: 304 },
  { id: "fGx6K90TmCI", title: "A Thousand Years", artist: "Christina Perri", mood: "romantic", genre: "pop", duration: 219 },
  { id: "3JWTaaS7LdU", title: "I Will Always Love You", artist: "Whitney Houston", mood: "romantic", genre: "pop", duration: 274 },
  { id: "LjhCEhWiKXk", title: "Just the Way You Are", artist: "Bruno Mars", mood: "romantic", genre: "pop", duration: 237 },
  { id: "hLQl3WQQoQ0", title: "Someone Like You", artist: "Adele", mood: "romantic", genre: "pop", duration: 285 },
  { id: "lWA2pjMjpBs", title: "Thinking Out Loud", artist: "Ed Sheeran", mood: "romantic", genre: "pop", duration: 283 },
  { id: "PIh2xe4jnpk", title: "Crazy in Love", artist: "Beyoncé ft. Jay-Z", mood: "romantic", genre: "r&b", duration: 225 },
  { id: "WpYeekQkAdc", title: "Everything I Do", artist: "Bryan Adams", mood: "romantic", genre: "rock", duration: 251 },
  { id: "JkK8g6FMEXE", title: "I Don't Want to Miss a Thing", artist: "Aerosmith", mood: "romantic", genre: "rock", duration: 293 },
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

export function saveDJClip(
  id: string,
  songId: string,
  nextSongId: string,
  slotName: string,
  mood: string,
  script: string,
  audio: Buffer,
  durationMs?: number
): void {
  getDb().prepare(
    'INSERT OR REPLACE INTO dj_clips (id, song_id, next_song_id, slot_name, mood, script, audio, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, songId, nextSongId, slotName, mood, script, audio, durationMs || null);
}

export function getDJClip(id: string): { id: string; script: string; audio: Buffer; duration_ms: number | null } | null {
  return getDb().prepare(
    'SELECT id, script, audio, duration_ms FROM dj_clips WHERE id = ?'
  ).get(id) as { id: string; script: string; audio: Buffer; duration_ms: number | null } | null;
}

export function getDJClipForTransition(songId: string, nextSongId: string): { id: string; script: string; audio: Buffer; duration_ms: number | null } | null {
  return getDb().prepare(
    'SELECT id, script, audio, duration_ms FROM dj_clips WHERE song_id = ? AND next_song_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(songId, nextSongId) as { id: string; script: string; audio: Buffer; duration_ms: number | null } | null;
}

export function pruneOldClips(): void {
  getDb().prepare(`
    DELETE FROM dj_clips WHERE id NOT IN (
      SELECT id FROM dj_clips ORDER BY created_at DESC LIMIT 200
    )
  `).run();
}
