import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import { songs, getSongsByMood } from './songs.js';
import { getCurrentSlot, seededShuffle, getDaySeed } from './schedule.js';

const SONGS_DIR = '/audio/songs';
const DJ_DIR = '/audio/dj';
const ICECAST_URL = 'icecast://source:z0fm_src_2026@localhost:8000/stream';

const openai = new OpenAI();

// Ensure directories exist
[SONGS_DIR, DJ_DIR].forEach(d => mkdirSync(d, { recursive: true }));

// --- Song downloading ---

function songPath(song) {
  // Sanitize filename
  const safe = `${song.id}`.replace(/[^a-zA-Z0-9_-]/g, '');
  return join(SONGS_DIR, `${safe}.mp3`);
}

function downloadSong(song) {
  const path = songPath(song);
  if (existsSync(path)) return path;

  console.log(`[download] ${song.title} — ${song.artist}`);
  try {
    const output = execSync(
      `yt-dlp -x --audio-format mp3 --audio-quality 2 --no-playlist --no-check-certificates ` +
      `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" ` +
      `-o "${path}" "https://www.youtube.com/watch?v=${song.id}" 2>&1`,
      { timeout: 120000 }
    ).toString();
    console.log(`[download] ${song.title}: ${output.split('\n').pop()}`);
    if (existsSync(path)) return path;
  } catch (err) {
    const errOutput = err.stdout?.toString() || err.stderr?.toString() || err.message;
    console.error(`[download] FAILED: ${song.title} — ${errOutput.slice(-200)}`);
  }
  return null;
}

async function downloadSongsForMood(mood) {
  const moodSongs = getSongsByMood(mood);
  const available = [];
  for (const song of moodSongs) {
    const path = downloadSong(song);
    if (path) available.push({ ...song, path });
  }
  return available;
}

// --- DJ voice generation ---

async function generateDJClip(slot, previousSong, nextSong) {
  const clipPath = join(DJ_DIR, `dj_${Date.now()}.mp3`);

  try {
    // Generate script
    const prompt = previousSong
      ? `Mood: ${slot.mood}. "${previousSong.title}" by ${previousSong.artist} just finished. Next up: "${nextSong.title}" by ${nextSong.artist}. Write a transition.`
      : `Mood: ${slot.mood}. You're opening the ${slot.name} show on Zo FM. First song: "${nextSong.title}" by ${nextSong.artist}. Write an intro.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.9,
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `You are ${slot.djName}, a radio DJ on Zo FM. Your style matches the ${slot.name} show. Keep intros to 2-3 short sentences max. Never use emojis or hashtags. Sound natural like a real FM DJ.`,
        },
        { role: 'user', content: prompt },
      ],
    });

    const script = completion.choices[0].message.content;
    console.log(`[dj] ${slot.djName}: "${script}"`);

    // Generate TTS
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: slot.voice,
      input: script,
      response_format: 'mp3',
      speed: 1.0,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    writeFileSync(clipPath, buffer);
    return clipPath;
  } catch (err) {
    console.error(`[dj] TTS failed: ${err.message}`);
    return null;
  }
}

// --- FFmpeg streaming ---

function streamToIcecast(playlistFile) {
  return new Promise((resolve, reject) => {
    console.log(`[ffmpeg] Starting stream...`);
    const proc = spawn('ffmpeg', [
      '-re',                          // Real-time playback speed
      '-f', 'concat',
      '-safe', '0',
      '-i', playlistFile,
      '-af', 'afade=t=in:d=1,afade=t=out:st=0:d=1', // gentle fades
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      '-content_type', 'audio/mpeg',
      '-f', 'mp3',
      ICECAST_URL,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stdout.on('data', d => process.stdout.write(d));
    proc.stderr.on('data', d => {
      const msg = d.toString();
      // Only log important FFmpeg messages
      if (msg.includes('Error') || msg.includes('Opening') || msg.includes('Stream mapping')) {
        console.log(`[ffmpeg] ${msg.trim()}`);
      }
    });

    proc.on('close', (code) => {
      console.log(`[ffmpeg] Process exited with code ${code}`);
      resolve(code);
    });
    proc.on('error', reject);
  });
}

// --- Cleanup old DJ clips ---

function cleanupDJClips() {
  try {
    const files = readdirSync(DJ_DIR).filter(f => f.startsWith('dj_'));
    // Keep last 5, delete rest
    if (files.length > 5) {
      files.sort().slice(0, files.length - 5).forEach(f => {
        try { unlinkSync(join(DJ_DIR, f)); } catch {}
      });
    }
  } catch {}
}

// --- Main radio loop ---

async function radioLoop() {
  console.log('\n=== ZO FM RADIO SERVER ===\n');

  while (true) {
    const slot = getCurrentSlot();
    console.log(`\n[schedule] Current slot: ${slot.name} (${slot.mood})`);

    // Download songs for current mood
    const available = await downloadSongsForMood(slot.mood);
    if (available.length === 0) {
      console.error(`[error] No songs available for mood: ${slot.mood}. Retrying in 30s...`);
      await sleep(30000);
      continue;
    }

    // Shuffle deterministically for today
    const seed = getDaySeed() + slot.startHour;
    const shuffled = seededShuffle(available, seed);
    console.log(`[playlist] ${shuffled.length} songs queued for ${slot.name}`);

    // Build playlist with DJ clips between songs
    const playlistPath = '/tmp/playlist.txt';
    let playlistContent = '';
    let previousSong = null;

    for (let i = 0; i < shuffled.length; i++) {
      const song = shuffled[i];

      // Generate DJ clip before each song
      const djClip = await generateDJClip(slot, previousSong, song);
      if (djClip) {
        playlistContent += `file '${djClip}'\n`;
      }
      playlistContent += `file '${song.path}'\n`;
      previousSong = song;
    }

    writeFileSync(playlistPath, playlistContent);
    console.log(`[playlist] Written to ${playlistPath}`);

    // Stream the playlist
    const exitCode = await streamToIcecast(playlistPath);

    // Cleanup and check if slot changed
    cleanupDJClips();

    if (exitCode !== 0) {
      console.log('[stream] FFmpeg exited unexpectedly, restarting in 5s...');
      await sleep(5000);
    }

    // Loop continues — will check slot again and rebuild playlist
    console.log('[stream] Playlist finished, cycling...');
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// --- Wait for Icecast to be ready ---

async function waitForIcecast(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch('http://localhost:8000/status-json.xsl');
      if (res.ok) {
        console.log('[icecast] Ready!');
        return true;
      }
    } catch {}
    console.log(`[icecast] Waiting... (${i + 1}/${maxRetries})`);
    await sleep(2000);
  }
  throw new Error('Icecast failed to start');
}

// --- Entry point ---

async function main() {
  console.log('[boot] Waiting for Icecast...');
  await waitForIcecast();
  await radioLoop();
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
