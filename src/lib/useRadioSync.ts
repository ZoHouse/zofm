'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface NowPlayingData {
  song: { id: string; title: string; artist: string; mood: string; genre: string };
  seekTo: number;
  duration: number;
  slot: { name: string; mood: string; djName: string; voice: string };
  nextSong: { id: string; title: string; artist: string };
  previousSong: { id: string; title: string; artist: string };
  playlistIndex: number;
  playlistLength: number;
  serverTime: number;
}

interface RadioState {
  status: 'prefetching' | 'ready' | 'loading' | 'playing' | 'dj-speaking' | 'error';
  currentSong: NowPlayingData['song'] | null;
  slot: NowPlayingData['slot'] | null;
  djScript: string;
  error: string | null;
}

export function useRadioSync() {
  const [state, setState] = useState<RadioState>({
    status: 'prefetching',
    currentSong: null,
    slot: null,
    djScript: '',
    error: null,
  });

  const playerRef = useRef<YT.Player | null>(null);
  const currentSongIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const djPlayedForRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isActiveRef = useRef(false);
  const prefetchedRef = useRef<NowPlayingData | null>(null);
  const playerReadyRef = useRef(false);

  // Fade state — only one fade at a time
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Playback monitor — polls YouTube player for real remaining time
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefetchStartedForRef = useRef<string | null>(null);
  const fadeStartedForRef = useRef<string | null>(null);

  // Pre-fetched DJ clip for next transition
  const prefetchedDJRef = useRef<{ audioBlob: Blob; script: string; forSongId: string } | null>(null);

  // Latest now-playing data (for building DJ transitions)
  const latestDataRef = useRef<NowPlayingData | null>(null);

  const fetchNowPlaying = useCallback(async (): Promise<NowPlayingData | null> => {
    try {
      const res = await fetch('/api/radio/now-playing');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return await res.json();
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to connect',
      }));
      return null;
    }
  }, []);

  // Prefetch now-playing data on mount
  useEffect(() => {
    let cancelled = false;
    fetchNowPlaying().then(data => {
      if (cancelled || !data) return;
      prefetchedRef.current = data;
      setState(prev => ({ ...prev, status: 'ready', slot: data.slot }));
    });
    return () => { cancelled = true; };
  }, [fetchNowPlaying]);

  // Cancellable volume fade — cancels any previous fade first
  const fadeVolume = useCallback((target: number, durationMs: number = 800): Promise<void> => {
    // Cancel any in-progress fade
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    const player = playerRef.current;
    if (!player) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const start = player.getVolume();
      if (Math.abs(start - target) < 2) { player.setVolume(target); resolve(); return; }

      const steps = Math.max(10, Math.floor(durationMs / 50));
      const stepMs = durationMs / steps;
      const delta = (target - start) / steps;
      let step = 0;

      fadeIntervalRef.current = setInterval(() => {
        step++;
        if (step >= steps) {
          player.setVolume(target);
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
          resolve();
        } else {
          player.setVolume(Math.round(start + delta * step));
        }
      }, stepMs);
    });
  }, []);

  // Get or create AudioContext (created once in user gesture, reused)
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  // Play a DJ audio blob and return a promise that resolves when done
  const playDJAudio = useCallback((blob: Blob): Promise<void> => {
    const url = URL.createObjectURL(blob);
    return new Promise<void>((resolve) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.volume = 1.0;

      try {
        const ctx = getAudioContext();
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = 2.5;
        source.connect(gain);
        gain.connect(ctx.destination);
      } catch (e) {
        console.warn('[zo-fm] Web Audio gain fallback:', e);
      }

      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = (e) => { console.error('[zo-fm] DJ audio error:', e); URL.revokeObjectURL(url); resolve(); };
      audio.play().catch((e) => { console.error('[zo-fm] DJ play blocked:', e); URL.revokeObjectURL(url); resolve(); });
    });
  }, [getAudioContext]);

  // Generate DJ script + TTS, returns blob + script or null on failure
  const generateDJClip = useCallback(async (
    slot: NowPlayingData['slot'],
    previousSong: { title: string; artist: string },
    nextSong: { id?: string; title: string; artist: string },
  ): Promise<{ blob: Blob; script: string } | null> => {
    try {
      const scriptRes = await fetch('/api/dj/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: slot.mood,
          previousSong,
          nextSong,
          djName: slot.djName,
          djStyle: getDJStyle(slot.mood),
        }),
      });
      if (!scriptRes.ok) return null;
      const { script } = await scriptRes.json();

      const ttsRes = await fetch('/api/dj/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, voice: slot.voice }),
      });
      if (!ttsRes.ok) return null;

      const blob = await ttsRes.blob();
      return { blob, script };
    } catch (err) {
      console.error('[zo-fm] DJ generation failed:', err);
      return null;
    }
  }, []);

  // The full crossfade transition sequence
  const performCrossfade = useCallback(async () => {
    if (!isActiveRef.current) return;

    const data = latestDataRef.current;
    if (!data) return;

    // Mark DJ as played for the next song
    djPlayedForRef.current = data.nextSong.id;

    // Step 1: Get DJ audio (pre-fetched or generate now)
    let djBlob: Blob | null = null;
    let djScript = '';

    const prefetched = prefetchedDJRef.current;
    if (prefetched && prefetched.forSongId === data.nextSong.id) {
      djBlob = prefetched.audioBlob;
      djScript = prefetched.script;
      prefetchedDJRef.current = null;
      console.log('[zo-fm] Using pre-fetched DJ clip');
    } else {
      // Clean up stale prefetch
      prefetchedDJRef.current = null;
      console.log('[zo-fm] Generating DJ clip on the fly...');
      const result = await generateDJClip(data.slot, data.song, data.nextSong);
      if (result && isActiveRef.current) {
        djBlob = result.blob;
        djScript = result.script;
      }
    }

    if (!isActiveRef.current) return;

    // Step 2: Fade out current song (may already be faded if monitor caught it)
    const player = playerRef.current;
    if (player && player.getVolume() > 5) {
      await fadeVolume(0, 2000);
    }

    if (!isActiveRef.current) return;

    // Step 3: Play DJ clip if we have one
    if (djBlob) {
      setState(prev => ({ ...prev, djScript, status: 'dj-speaking' }));
      await playDJAudio(djBlob);
    }

    if (!isActiveRef.current) return;

    // Step 4: Fetch fresh now-playing to get correct seekTo for the new song
    const freshData = await fetchNowPlaying();
    if (!freshData || !isActiveRef.current) return;

    // Step 5: Load next song at volume 0
    if (player) {
      currentSongIdRef.current = freshData.song.id;
      player.setVolume(0);
      player.loadVideoById({ videoId: freshData.song.id, startSeconds: freshData.seekTo });
    }

    setState(prev => ({
      ...prev,
      currentSong: freshData.song,
      slot: freshData.slot,
      status: 'playing',
      djScript: '',
      error: null,
    }));
    latestDataRef.current = freshData;

    // Step 6: Fade in
    await new Promise(r => setTimeout(r, 300)); // small breath
    await fadeVolume(80, 1500);

    // Reset monitor flags for the new song
    prefetchStartedForRef.current = null;
    fadeStartedForRef.current = null;

    // Schedule next poll based on fresh data
    const remaining = freshData.duration - freshData.seekTo;
    pollTimerRef.current = setTimeout(syncToServer, Math.min(remaining * 1000 + 2000, 30000));
  }, [fadeVolume, playDJAudio, generateDJClip, fetchNowPlaying]);

  // Playback monitor — checks YouTube's actual remaining time every second
  const startMonitor = useCallback(() => {
    if (monitorRef.current) clearInterval(monitorRef.current);

    monitorRef.current = setInterval(() => {
      if (!isActiveRef.current) return;

      const player = playerRef.current;
      const data = latestDataRef.current;
      if (!player || !data) return;

      // Use YouTube's real duration and current time
      let ytDuration: number;
      let ytCurrent: number;
      try {
        ytDuration = player.getDuration();
        ytCurrent = player.getCurrentTime();
      } catch {
        return; // player not ready
      }

      if (!ytDuration || ytDuration <= 0) return;
      const remaining = ytDuration - ytCurrent;

      // At ~15s remaining: pre-fetch DJ clip
      if (remaining < 16 && remaining > 5 && prefetchStartedForRef.current !== data.song.id) {
        prefetchStartedForRef.current = data.song.id;
        console.log(`[zo-fm] ${Math.round(remaining)}s remaining — pre-fetching DJ clip`);
        generateDJClip(data.slot, data.song, data.nextSong).then(result => {
          if (result && isActiveRef.current) {
            prefetchedDJRef.current = {
              audioBlob: result.blob,
              script: result.script,
              forSongId: data.nextSong.id,
            };
            console.log('[zo-fm] DJ clip pre-fetched');
          }
        });
      }

      // At ~8s remaining: start fading out
      if (remaining < 9 && remaining > 1 && fadeStartedForRef.current !== data.song.id) {
        fadeStartedForRef.current = data.song.id;
        console.log(`[zo-fm] ${Math.round(remaining)}s remaining — fading out`);
        fadeVolume(0, remaining * 1000); // Fade to 0 over remaining time
      }
    }, 1000);
  }, [generateDJClip, fadeVolume]);

  // syncToServer declaration needs to be before performCrossfade uses it,
  // but performCrossfade also calls syncToServer. We use a ref to break the cycle.
  const syncToServerRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const syncToServer = useCallback(async () => {
    if (!isActiveRef.current) return;

    const data = await fetchNowPlaying();
    if (!data || !isActiveRef.current) return;

    latestDataRef.current = data;

    setState(prev => ({
      ...prev,
      currentSong: data.song,
      slot: data.slot,
      status: prev.status === 'dj-speaking' ? 'dj-speaking' : 'playing',
      error: null,
    }));

    const player = playerRef.current;
    if (!player) return;

    if (currentSongIdRef.current !== data.song.id) {
      const isOrganicTransition = currentSongIdRef.current !== null;

      if (isOrganicTransition) {
        // Song changed — perform crossfade transition
        // Stop the monitor during transition (we'll restart after)
        if (monitorRef.current) clearInterval(monitorRef.current);
        await performCrossfade();
        startMonitor();
        return; // performCrossfade handles its own poll scheduling
      } else {
        // First song — just play it
        currentSongIdRef.current = data.song.id;
        player.loadVideoById({ videoId: data.song.id, startSeconds: data.seekTo });
        player.setVolume(80);
        startMonitor();

        // Play intro DJ clip (duck style, not crossfade)
        if (data.seekTo <= 15) {
          djPlayedForRef.current = data.song.id;
          const result = await generateDJClip(data.slot, data.previousSong, data.song);
          if (result && isActiveRef.current) {
            setState(prev => ({ ...prev, djScript: result.script, status: 'dj-speaking' }));
            await fadeVolume(12, 600);
            await playDJAudio(result.blob);
            await new Promise(r => setTimeout(r, 400));
            await fadeVolume(80, 1000);
            setState(prev => ({ ...prev, status: 'playing', djScript: '' }));
          }
        }
      }
    }

    const remainingSeconds = data.duration - data.seekTo;
    const nextCheckMs = Math.min(remainingSeconds * 1000 + 2000, 30000);
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(syncToServer, nextCheckMs);
  }, [fetchNowPlaying, performCrossfade, startMonitor, generateDJClip, fadeVolume, playDJAudio]);

  // Keep the ref in sync
  syncToServerRef.current = syncToServer;

  // tuneIn — called from click handler
  const tuneIn = useCallback(() => {
    isActiveRef.current = true;

    // Create AudioContext in user gesture context
    try { getAudioContext(); } catch { /* ok */ }

    const player = playerRef.current;
    const data = prefetchedRef.current;

    if (!player || !data) {
      setState(prev => ({ ...prev, status: 'loading', error: null }));
      syncToServer();
      return;
    }

    // Immediate playback from prefetched data
    const elapsed = Math.floor((Date.now() - data.serverTime) / 1000);
    const adjustedSeek = data.seekTo + elapsed;

    currentSongIdRef.current = data.song.id;
    latestDataRef.current = { ...data, seekTo: adjustedSeek };
    player.loadVideoById({ videoId: data.song.id, startSeconds: adjustedSeek });
    player.setVolume(80);

    setState({
      status: 'playing',
      currentSong: data.song,
      slot: data.slot,
      djScript: '',
      error: null,
    });

    // Start playback monitor
    startMonitor();

    // Intro DJ clip in background (duck, not crossfade)
    if (adjustedSeek <= 15) {
      djPlayedForRef.current = data.song.id;
      generateDJClip(data.slot, data.previousSong, data.song).then(async result => {
        if (!result || !isActiveRef.current) return;
        setState(prev => ({ ...prev, djScript: result.script, status: 'dj-speaking' }));
        await fadeVolume(12, 600);
        await playDJAudio(result.blob);
        await new Promise(r => setTimeout(r, 400));
        await fadeVolume(80, 1000);
        if (isActiveRef.current) {
          setState(prev => ({ ...prev, status: 'playing', djScript: '' }));
        }
      });
    }

    // Start polling
    const remaining = data.duration - adjustedSeek;
    pollTimerRef.current = setTimeout(syncToServer, Math.min(remaining * 1000 + 2000, 30000));

    // Fresh fetch to correct drift
    fetchNowPlaying().then(fresh => {
      if (!fresh || !isActiveRef.current) return;
      latestDataRef.current = fresh;
      if (fresh.song.id !== currentSongIdRef.current) {
        currentSongIdRef.current = fresh.song.id;
        if (playerRef.current) {
          playerRef.current.loadVideoById({ videoId: fresh.song.id, startSeconds: fresh.seekTo });
        }
        setState(prev => ({ ...prev, currentSong: fresh.song, slot: fresh.slot }));
      }
    });
  }, [fetchNowPlaying, syncToServer, startMonitor, generateDJClip, fadeVolume, playDJAudio, getAudioContext]);

  const onPlayerReady = useCallback((event: { target: YT.Player }) => {
    playerRef.current = event.target;
    playerReadyRef.current = true;
    event.target.setVolume(80);
  }, []);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (monitorRef.current) clearInterval(monitorRef.current);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    ...state,
    tuneIn,
    playerRef,
    onPlayerReady,
  };
}

function getDJStyle(mood: string): string {
  const styles: Record<string, string> = {
    energetic: 'Morning energy at a Zo House. You sound like the first person up making chai for everyone. Warm, excited, ready to build. Reference morning routines, sunrise from the rooftop, citizens starting their day.',
    chill: 'Midday wind-down vibes. You sound like someone on the common room couch after a productive morning. Talk about the flow state, the afternoon light, citizens scattered across the house doing their thing.',
    focus: 'Deep work hours. You are the quietest DJ — minimal words, maximum respect for concentration. Reference co-working sessions, builders shipping code, creators in the zone. Almost whisper-like.',
    romantic: 'Pre-dawn intimacy. You sound like a late-night conversation on the rooftop that got deep. Reference connections made at Zo Houses, strangers becoming friends becoming family, the magic of shared spaces.',
    party: 'Evening gathering energy. You sound like the one who just connected the aux at a Zo House party. Bold, warm, inclusive. Reference the evening events, citizens coming together, the common room turning into a dance floor. Never say let\'s go.',
    'late-night': 'Post-midnight philosopher. You sound like the last three people awake in the kitchen having the realest conversation. Reference late night coding sessions, 3am kitchen raids, the quiet magic of Zo Houses after dark.',
  };
  return styles[mood] || styles.chill;
}
