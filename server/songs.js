// Song catalog — YouTube video IDs tagged by mood
// The server downloads these via yt-dlp on startup

export const songs = [
  // ENERGETIC (Morning 6-10 IST)
  { id: "JGwWNGJdvx8", title: "Shape of You", artist: "Ed Sheeran", mood: "energetic" },
  { id: "kJQP7kiw5Fk", title: "Despacito", artist: "Luis Fonsi ft. Daddy Yankee", mood: "energetic" },
  { id: "OPf0YbXqDm0", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", mood: "energetic" },
  { id: "CevxZvSJLk8", title: "Roar", artist: "Katy Perry", mood: "energetic" },
  { id: "09R8_2nJtjg", title: "Sugar", artist: "Maroon 5", mood: "energetic" },
  { id: "nfs8NYg7yQM", title: "HUMBLE.", artist: "Kendrick Lamar", mood: "energetic" },
  { id: "DyDfgMOUjCI", title: "Bom Diggy Diggy", artist: "Zack Knight & Jasmin Walia", mood: "energetic" },
  { id: "7PCkvCPvDXk", title: "Kar Gayi Chull", artist: "Badshah & Neha Kakkar", mood: "energetic" },
  { id: "RgKAFK5djSk", title: "See You Again", artist: "Wiz Khalifa ft. Charlie Puth", mood: "energetic" },
  { id: "iS1g8G_njx8", title: "Cheap Thrills", artist: "Sia ft. Sean Paul", mood: "energetic" },

  // CHILL (Midday 10-14 IST)
  { id: "lp-EO5I60KA", title: "Tum Hi Ho", artist: "Arijit Singh", mood: "chill" },
  { id: "450p7goxZqg", title: "Perfect", artist: "Ed Sheeran", mood: "chill" },
  { id: "bo_efYhYU2A", title: "Agar Tum Saath Ho", artist: "Arijit Singh & Alka Yagnik", mood: "chill" },
  { id: "60ItHLz5WEA", title: "All of Me", artist: "John Legend", mood: "chill" },
  { id: "RBumgq5yVrA", title: "Photograph", artist: "Ed Sheeran", mood: "chill" },
  { id: "7maJOI3QMu0", title: "Stay With Me", artist: "Sam Smith", mood: "chill" },
  { id: "hLQl3WQQoQ0", title: "Someone Like You", artist: "Adele", mood: "chill" },
  { id: "YQHsXMglC9A", title: "Hello", artist: "Adele", mood: "chill" },
  { id: "qemWRToNYJY", title: "Humdard", artist: "Arijit Singh", mood: "chill" },
  { id: "nfWlot6h_JM", title: "Say You Won't Let Go", artist: "James Arthur", mood: "chill" },

  // FOCUS (Afternoon 14-18 IST)
  { id: "lTRiuFIWV54", title: "Interstellar Main Theme", artist: "Hans Zimmer", mood: "focus" },
  { id: "Fe93CLbHjxQ", title: "Time (Inception)", artist: "Hans Zimmer", mood: "focus" },
  { id: "n61ULFL0_j8", title: "Weightless", artist: "Marconi Union", mood: "focus" },
  { id: "WDXPJWIgX-o", title: "Nuvole Bianche", artist: "Ludovico Einaudi", mood: "focus" },
  { id: "4N3N1MlvVc4", title: "River Flows in You", artist: "Yiruma", mood: "focus" },
  { id: "kgx4WGK0oNU", title: "Clair de Lune", artist: "Debussy", mood: "focus" },
  { id: "7kkRkhAXZGg", title: "Ilahi", artist: "Arijit Singh", mood: "focus" },
  { id: "5qap5aO4i9A", title: "Lofi Hip Hop Radio", artist: "Lofi Girl", mood: "focus" },
  { id: "HuFYqnbVbzY", title: "Cornfield Chase", artist: "Hans Zimmer", mood: "focus" },
  { id: "pUZeSYsU0Uk", title: "Kun Faya Kun", artist: "A.R. Rahman", mood: "focus" },

  // PARTY (Evening 18-22 IST)
  { id: "kTJczUoc26U", title: "Lean On", artist: "Major Lazer & DJ Snake", mood: "party" },
  { id: "hT_nvWreIhg", title: "Counting Stars", artist: "OneRepublic", mood: "party" },
  { id: "fRh_vgS2dFE", title: "Sorry", artist: "Justin Bieber", mood: "party" },
  { id: "nYh-n7EOtMA", title: "London Thumakda", artist: "Labh Janjua", mood: "party" },
  { id: "2vjPBrBU-TM", title: "Savage Love", artist: "Jawsh 685 & Jason Derulo", mood: "party" },
  { id: "IcrbM1l_BoI", title: "Closer", artist: "The Chainsmokers ft. Halsey", mood: "party" },
  { id: "ru0K8uYEZWw", title: "Thunder", artist: "Imagine Dragons", mood: "party" },
  { id: "hHW1oY26kxQ", title: "Gallan Goodiyaan", artist: "Dil Dhadakne Do", mood: "party" },
  { id: "kXYiU_JCYtU", title: "Numb", artist: "Linkin Park", mood: "party" },
  { id: "bx1Bh8ZvH84", title: "Hymn for the Weekend", artist: "Coldplay", mood: "party" },

  // LATE-NIGHT (22-02 IST)
  { id: "fJ9rUzIMcZQ", title: "Bohemian Rhapsody", artist: "Queen", mood: "late-night" },
  { id: "4fndeDfaWCg", title: "Blinding Lights", artist: "The Weeknd", mood: "late-night" },
  { id: "RvA3q0ZU-NQ", title: "Starboy", artist: "The Weeknd ft. Daft Punk", mood: "late-night" },
  { id: "YnwfTHpnGLY", title: "Radioactive", artist: "Imagine Dragons", mood: "late-night" },
  { id: "aJOTlE1K90k", title: "Phir Le Aya Dil", artist: "Arijit Singh", mood: "late-night" },
  { id: "RtCxvv8Y3Bs", title: "Excuses", artist: "AP Dhillon & Gurinder Gill", mood: "late-night" },
  { id: "k2qgadSvNyU", title: "Brown Munde", artist: "AP Dhillon", mood: "late-night" },
  { id: "QdBZY2fkU-0", title: "500 Miles", artist: "The Proclaimers", mood: "late-night" },
  { id: "FTQbiNvZqaY", title: "Africa", artist: "Toto", mood: "late-night" },
  { id: "sOnqjkJTMaA", title: "Throw a Fit", artist: "Tinashe", mood: "late-night" },

  // ROMANTIC (Overnight 02-06 IST)
  { id: "0yW7w8F2TVA", title: "Tum Se Hi", artist: "Mohit Chauhan", mood: "romantic" },
  { id: "lWA2pjMjpBs", title: "Thinking Out Loud", artist: "Ed Sheeran", mood: "romantic" },
  { id: "nSDgHBxUbVQ", title: "Channa Mereya", artist: "Arijit Singh", mood: "romantic" },
  { id: "rtOvBOTyX00", title: "Kal Ho Naa Ho", artist: "Sonu Nigam", mood: "romantic" },
  { id: "PIh2xe4jnpk", title: "Crazy in Love", artist: "Beyonce ft. Jay-Z", mood: "romantic" },
  { id: "fGx6K90TmCI", title: "A Thousand Years", artist: "Christina Perri", mood: "romantic" },
  { id: "WpYeekQkAdc", title: "Everything I Do", artist: "Bryan Adams", mood: "romantic" },
  { id: "R-gCljdWa3g", title: "Raabta", artist: "Arijit Singh", mood: "romantic" },
  { id: "3AtDnEC4zak", title: "All of Me (Live)", artist: "John Legend", mood: "romantic" },
  { id: "kPa7bsKwL-c", title: "Hawayein", artist: "Arijit Singh", mood: "romantic" },
];

export function getSongsByMood(mood) {
  return songs.filter(s => s.mood === mood);
}
