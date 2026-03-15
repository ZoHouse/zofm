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
  const isActiveRef = useRef(false);
  const prefetchedRef = useRef<NowPlayingData | null>(null);
  const playerReadyRef = useRef(false);
  const transitionInProgressRef = useRef(false);

  // Fade state — only one fade at a time
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Playback monitor
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefetchStartedForRef = useRef<string | null>(null);
  const crossfadeStartedForRef = useRef<string | null>(null);

  // Server-based fallback timer (in case YouTube getDuration fails or tab is backgrounded)
  const serverFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to performCrossfade so the fallback timer can call it without circular deps
  const performCrossfadeRef = useRef<() => void>(() => {});

  // Pre-fetched DJ clip for next transition
  const prefetchedDJRef = useRef<{ audioBlob: Blob; script: string; forSongId: string } | null>(null);

  // Latest now-playing data
  const latestDataRef = useRef<NowPlayingData | null>(null);

  // Grace period after crossfade — don't let polls overwrite song info
  const crossfadeCompletedAtRef = useRef<number>(0);

  // Track which songs we've already reported duration corrections for
  const durationReportedForRef = useRef<Set<string>>(new Set());

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

  // Cancellable volume fade
  const fadeVolume = useCallback((target: number, durationMs: number = 800): Promise<void> => {
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

  // Play DJ audio blob — plain HTML5 Audio, no WebAudio API
  // WebAudio's createMediaElementSource permanently captures audio output
  // and silently dies when AudioContext suspends outside user gesture context
  const createDJAudio = useCallback(async (blob: Blob): Promise<{ audio: HTMLAudioElement; done: Promise<void> }> => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.volume = 1.0;

    const done = new Promise<void>((resolve) => {
      audio.onended = () => {
        console.log('[zo-fm] DJ audio ended naturally');
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = (e) => {
        console.error('[zo-fm] DJ audio playback error:', e);
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.play().then(() => {
        console.log('[zo-fm] DJ audio playing');
      }).catch((e) => {
        console.error('[zo-fm] DJ audio play() rejected:', e);
        URL.revokeObjectURL(url);
        resolve();
      });
    });

    return { audio, done };
  }, []);

  // Generate DJ script + TTS (with retry)
  const generateDJClipOnce = useCallback(async (
    slot: NowPlayingData['slot'],
    previousSong: { title: string; artist: string },
    nextSong: { id?: string; title: string; artist: string },
  ): Promise<{ blob: Blob; script: string } | null> => {
    const t0 = Date.now();
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
    if (!scriptRes.ok) {
      const errBody = await scriptRes.text().catch(() => '');
      console.error(`[zo-fm] DJ script failed: HTTP ${scriptRes.status} — ${errBody}`);
      return null;
    }
    const { script } = await scriptRes.json();
    console.log(`[zo-fm] DJ script generated in ${Date.now() - t0}ms (${script.length} chars)`);

    const t1 = Date.now();
    const ttsRes = await fetch('/api/dj/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: script, voice: slot.voice }),
    });
    if (!ttsRes.ok) {
      const errBody = await ttsRes.text().catch(() => '');
      console.error(`[zo-fm] DJ TTS failed: HTTP ${ttsRes.status} — ${errBody}`);
      return null;
    }

    const blob = await ttsRes.blob();
    console.log(`[zo-fm] DJ TTS generated in ${Date.now() - t1}ms (${blob.size} bytes)`);
    return { blob, script };
  }, []);

  const generateDJClip = useCallback(async (
    slot: NowPlayingData['slot'],
    previousSong: { title: string; artist: string },
    nextSong: { id?: string; title: string; artist: string },
  ): Promise<{ blob: Blob; script: string } | null> => {
    try {
      const result = await generateDJClipOnce(slot, previousSong, nextSong);
      if (result) return result;

      // Retry once after a brief pause
      console.log('[zo-fm] DJ generation failed, retrying...');
      await new Promise(r => setTimeout(r, 500));
      return await generateDJClipOnce(slot, previousSong, nextSong);
    } catch (err) {
      console.error('[zo-fm] DJ generation error:', err);
      // Retry once on network errors
      try {
        console.log('[zo-fm] DJ generation threw, retrying...');
        await new Promise(r => setTimeout(r, 500));
        return await generateDJClipOnce(slot, previousSong, nextSong);
      } catch (retryErr) {
        console.error('[zo-fm] DJ generation retry also failed:', retryErr);
        return null;
      }
    }
  }, [generateDJClipOnce]);

  // Server-based timer: schedule DJ pre-fetch and crossfade based on server's duration
  // This is the PRIMARY trigger for background tabs where setInterval is throttled to ~1/min
  // Two timers: one for pre-fetch (~25s before end), one for crossfade (~15s before end)
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleServerFallback = useCallback((remainingSeconds: number) => {
    if (serverFallbackTimerRef.current) clearTimeout(serverFallbackTimerRef.current);
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);

    // Schedule DJ pre-fetch at ~25s before end
    const prefetchMs = Math.max((remainingSeconds - 25) * 1000, 2000);
    prefetchTimerRef.current = setTimeout(() => {
      if (!isActiveRef.current || transitionInProgressRef.current) return;
      if (prefetchStartedForRef.current === (currentSongIdRef.current || latestDataRef.current?.song.id)) return;
      const data = latestDataRef.current;
      if (!data) return;
      const songId = currentSongIdRef.current || data.song.id;
      prefetchStartedForRef.current = songId;
      console.log('[zo-fm] Server timer: pre-fetching DJ clip');
      generateDJClip(data.slot, data.song, data.nextSong).then(result => {
        if (result && isActiveRef.current) {
          prefetchedDJRef.current = {
            audioBlob: result.blob,
            script: result.script,
            forSongId: data.nextSong.id,
          };
          console.log('[zo-fm] Server timer: DJ clip pre-fetched and ready');
        }
      });
    }, prefetchMs);

    // Schedule crossfade at ~15s before end
    const fallbackMs = Math.max((remainingSeconds - 15) * 1000, 5000);
    serverFallbackTimerRef.current = setTimeout(() => {
      if (!isActiveRef.current || transitionInProgressRef.current) return;
      // Only trigger if the YouTube monitor hasn't already started a crossfade
      if (crossfadeStartedForRef.current) return;
      console.log('[zo-fm] Server timer fired — starting crossfade');
      const data = latestDataRef.current;
      if (data) {
        crossfadeStartedForRef.current = currentSongIdRef.current || data.song.id;
        fadeVolume(15, 5000);
        performCrossfadeRef.current();
      }
    }, fallbackMs);
    console.log(`[zo-fm] Server timers: prefetch in ${Math.round(prefetchMs / 1000)}s, crossfade in ${Math.round(fallbackMs / 1000)}s`);
  }, [fadeVolume, generateDJClip]);

  // ===== THE CROSSFADE =====
  // This is triggered by the playback monitor when the song is about to end.
  // Flow:
  //   1. Music fading out (already started by monitor)
  //   2. DJ starts talking OVER the fading music (overlap)
  //   3. As DJ is wrapping up, next song loads at low volume (overlap)
  //   4. DJ finishes, next song fades up to full
  const performCrossfade = useCallback(async () => {
    if (!isActiveRef.current || transitionInProgressRef.current) return;
    transitionInProgressRef.current = true;

    const data = latestDataRef.current;
    if (!data) { transitionInProgressRef.current = false; return; }

    console.log('[zo-fm] Starting crossfade transition');
    djPlayedForRef.current = data.nextSong.id;

    try {
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
        prefetchedDJRef.current = null;
        console.log('[zo-fm] Generating DJ clip on the fly...');
        // Fade music down while we wait for generation
        fadeVolume(10, 3000);
        const result = await generateDJClip(data.slot, data.song, data.nextSong);
        if (result && isActiveRef.current) {
          djBlob = result.blob;
          djScript = result.script;
        }
      }

      if (!isActiveRef.current) return;

      // Step 2: Start DJ talking OVER the fading music
      // Music should already be fading down from the monitor
      // Duck it further so DJ voice is clear but music is still audible underneath
      if (djBlob) {
        setState(prev => ({ ...prev, djScript, status: 'dj-speaking' }));
        fadeVolume(8, 1000); // Duck music to 8% — still audible as a bed

        const { audio: djAudio, done: djDone } = await createDJAudio(djBlob);

        // Step 3: When DJ is ~75% done, load next song at volume 0
        // This creates the overlap — next song starts under DJ's voice
        // Use data.nextSong directly — server fetch can return stale data
        // if YouTube's actual duration differs from DB duration
        const nextSong = data.nextSong;
        const loadNextSongUnderDJ = () => {
          if (!djAudio.duration || !isActiveRef.current) return;

          const checkInterval = setInterval(() => {
            if (!djAudio.duration) return;
            const progress = djAudio.currentTime / djAudio.duration;

            if (progress > 0.75) {
              clearInterval(checkInterval);
              const player = playerRef.current;
              if (player) {
                currentSongIdRef.current = nextSong.id;
                player.setVolume(0);
                player.loadVideoById({ videoId: nextSong.id, startSeconds: 0 });
                console.log('[zo-fm] Next song loaded under DJ voice');

                setState(prev => ({
                  ...prev,
                  currentSong: {
                    id: nextSong.id,
                    title: nextSong.title,
                    artist: nextSong.artist,
                    mood: data.slot.mood,
                    genre: prev.currentSong?.genre || '',
                  },
                }));

                // Background sync — find our actual song in server's playlist
                // to get correct nextSong for future transitions
                fetchNowPlaying().then(fresh => {
                  if (fresh) {
                    // If server agrees on current song, use its data
                    // If not, still update but keep our song info
                    if (fresh.song.id === nextSong.id) {
                      latestDataRef.current = fresh;
                    } else {
                      // Server drifted — find our song in server's response
                      // Keep fresh data but correct the song reference
                      latestDataRef.current = {
                        ...fresh,
                        song: { id: nextSong.id, title: nextSong.title, artist: nextSong.artist, mood: data.slot.mood, genre: '' },
                      };
                    }
                  }
                });
              }
            }
          }, 200);

          // Safety: clear interval if DJ ends before 75%
          djAudio.addEventListener('ended', () => clearInterval(checkInterval), { once: true });
        };

        // Start monitoring DJ progress after a brief moment
        setTimeout(loadNextSongUnderDJ, 500);

        // Wait for DJ to finish
        await djDone;
      } else {
        // No DJ clip — just fade out and load next song
        await fadeVolume(0, 2000);
        const nextSong = data.nextSong;
        if (isActiveRef.current && playerRef.current) {
          currentSongIdRef.current = nextSong.id;
          playerRef.current.setVolume(0);
          playerRef.current.loadVideoById({ videoId: nextSong.id, startSeconds: 0 });
          setState(prev => ({
            ...prev,
            currentSong: {
              id: nextSong.id,
              title: nextSong.title,
              artist: nextSong.artist,
              mood: data.slot.mood,
              genre: prev.currentSong?.genre || '',
            },
            slot: data.slot,
          }));
          // Background sync for future transitions
          fetchNowPlaying().then(fresh => {
            if (fresh) {
              if (fresh.song.id === nextSong.id) {
                latestDataRef.current = fresh;
              } else {
                latestDataRef.current = {
                  ...fresh,
                  song: { id: nextSong.id, title: nextSong.title, artist: nextSong.artist, mood: data.slot.mood, genre: '' },
                };
              }
            }
          });
        }
      }

      if (!isActiveRef.current) return;

      // Step 4: DJ is done — make sure next song is loaded, then fade in smoothly
      const player = playerRef.current;
      if (player) {
        // If next song wasn't loaded yet (DJ was very short), load it now
        if (currentSongIdRef.current !== data.nextSong.id) {
          currentSongIdRef.current = data.nextSong.id;
          player.setVolume(0);
          player.loadVideoById({ videoId: data.nextSong.id, startSeconds: 0 });
          setState(prev => ({
            ...prev,
            currentSong: {
              id: data.nextSong.id,
              title: data.nextSong.title,
              artist: data.nextSong.artist,
              mood: data.slot.mood,
              genre: prev.currentSong?.genre || '',
            },
            slot: data.slot,
          }));
        }

        // Smooth fade in — the song is already playing silently
        await new Promise(r => setTimeout(r, 500)); // breath
        await fadeVolume(80, 2500); // Slow fade in over 2.5s
      }

      setState(prev => ({ ...prev, status: 'playing', djScript: '' }));

      // Mark crossfade completion — polls won't overwrite song info for 10s
      crossfadeCompletedAtRef.current = Date.now();

      // Reset monitor flags for new song
      prefetchStartedForRef.current = null;
      crossfadeStartedForRef.current = null;

      // Schedule next poll + server fallback timer for next crossfade
      const freshData = latestDataRef.current;
      if (freshData) {
        const remaining = freshData.duration - freshData.seekTo;
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        pollTimerRef.current = setTimeout(syncToServerFn, Math.min(remaining * 1000 + 2000, 30000));
        scheduleServerFallback(remaining);
      }
    } catch (err) {
      console.error('[zo-fm] Crossfade failed:', err);
      // Fallback: just load whatever the server says
      const fresh = await fetchNowPlaying();
      if (fresh && playerRef.current && isActiveRef.current) {
        currentSongIdRef.current = fresh.song.id;
        latestDataRef.current = fresh;
        playerRef.current.loadVideoById({ videoId: fresh.song.id, startSeconds: fresh.seekTo });
        playerRef.current.setVolume(80);
        setState(prev => ({ ...prev, currentSong: fresh.song, slot: fresh.slot, status: 'playing', djScript: '' }));
      }
    } finally {
      transitionInProgressRef.current = false;
    }
  }, [fadeVolume, createDJAudio, generateDJClip, fetchNowPlaying, scheduleServerFallback]);

  // Keep performCrossfadeRef in sync so server fallback timer can call it
  performCrossfadeRef.current = performCrossfade;

  // Playback monitor — checks YouTube's actual remaining time every second
  // This is the BRAIN — it triggers pre-fetch, fade-out, and crossfade
  const startMonitor = useCallback(() => {
    if (monitorRef.current) clearInterval(monitorRef.current);

    monitorRef.current = setInterval(() => {
      if (!isActiveRef.current || transitionInProgressRef.current) return;

      const player = playerRef.current;
      const data = latestDataRef.current;
      if (!player || !data) return;

      let ytDuration: number;
      let ytCurrent: number;
      try {
        ytDuration = player.getDuration();
        ytCurrent = player.getCurrentTime();
      } catch {
        return;
      }

      if (!ytDuration || ytDuration <= 0) return;

      // Report duration correction to server if YouTube's actual duration differs
      const actualSongId = currentSongIdRef.current || data.song.id;
      if (!durationReportedForRef.current.has(actualSongId) && Math.abs(ytDuration - data.duration) > 2) {
        durationReportedForRef.current.add(actualSongId);
        fetch('/api/radio/duration-correction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId: actualSongId, actualDuration: ytDuration }),
        }).catch(() => { /* non-critical */ });
        console.log(`[zo-fm] Duration correction: ${actualSongId} DB=${data.duration}s YT=${Math.round(ytDuration)}s`);
      }

      const remaining = ytDuration - ytCurrent;

      // At ~25s remaining: pre-fetch DJ clip (more time for longer scripts)
      if (remaining < 26 && remaining > 5 && prefetchStartedForRef.current !== actualSongId) {
        prefetchStartedForRef.current = actualSongId;
        console.log(`[zo-fm] ${Math.round(remaining)}s remaining — pre-fetching DJ clip`);
        generateDJClip(data.slot, data.song, data.nextSong).then(result => {
          if (result && isActiveRef.current) {
            prefetchedDJRef.current = {
              audioBlob: result.blob,
              script: result.script,
              forSongId: data.nextSong.id,
            };
            console.log('[zo-fm] DJ clip pre-fetched and ready');
          }
        });
      }

      // At ~15s remaining: start fading out AND start DJ clip (overlap!)
      // The DJ talks over the fading tail of the current song
      if (remaining < 16 && remaining > 2 && crossfadeStartedForRef.current !== actualSongId) {
        crossfadeStartedForRef.current = actualSongId;
        console.log(`[zo-fm] ${Math.round(remaining)}s remaining — starting crossfade`);

        // Start fading out the current song
        fadeVolume(15, 5000); // Fade to 15% over 5s — music becomes a bed for DJ

        // Trigger the full crossfade (DJ over fading music, then next song fades in)
        performCrossfade();
      }
    }, 1000);
  }, [generateDJClip, fadeVolume, performCrossfade]);

  // syncToServer — polls server for current song, handles first play and fallback
  const syncToServerFn = useCallback(async () => {
    if (!isActiveRef.current) return;

    const data = await fetchNowPlaying();
    if (!data || !isActiveRef.current) return;

    latestDataRef.current = data;

    const player = playerRef.current;
    if (!player) return;

    // Grace period: after a crossfade, the client knows better than the server
    // what's playing. Don't let stale server data overwrite the display.
    const inGracePeriod = Date.now() - crossfadeCompletedAtRef.current < 10000;

    if (currentSongIdRef.current !== data.song.id) {
      if (transitionInProgressRef.current || inGracePeriod) {
        // Crossfade is handling the transition or just finished — don't interfere
        // But still update latestDataRef with corrected song info for future transitions
        if (inGracePeriod && currentSongIdRef.current) {
          // Override server's stale position with what we're actually playing
          latestDataRef.current = { ...data, song: { ...data.song, id: currentSongIdRef.current } };
        }
        return;
      }

      const isOrganicTransition = currentSongIdRef.current !== null;

      if (isOrganicTransition) {
        // Song changed but monitor didn't catch it (e.g. song was shorter than expected)
        // Trigger crossfade now
        console.log('[zo-fm] Poll detected song change — starting crossfade');
        performCrossfade();
        return;
      } else {
        // First song — just play it
        currentSongIdRef.current = data.song.id;
        player.loadVideoById({ videoId: data.song.id, startSeconds: data.seekTo });
        player.setVolume(80);
        startMonitor();

        setState(prev => ({
          ...prev,
          currentSong: data.song,
          slot: data.slot,
          status: 'playing',
          error: null,
        }));

        // Always play intro DJ clip on first tune-in
        // Pass null as previousSong so the script API triggers intro mode
        djPlayedForRef.current = data.song.id;
        generateDJClip(data.slot, null as unknown as { title: string; artist: string }, data.song).then(async result => {
          if (!result || !isActiveRef.current) return;
          setState(prev => ({ ...prev, djScript: result.script, status: 'dj-speaking' }));
          await fadeVolume(12, 600);
          const { audio: _djAudio, done } = await createDJAudio(result.blob);
          await done;
          await new Promise(r => setTimeout(r, 400));
          await fadeVolume(80, 1000);
          if (isActiveRef.current) {
            setState(prev => ({ ...prev, status: 'playing', djScript: '' }));
          }
        });

        // Schedule server fallback for first song
        const firstRemaining = data.duration - data.seekTo;
        scheduleServerFallback(firstRemaining);
      }
    } else {
      // Same song — update slot/status but DON'T overwrite currentSong
      // The crossfade or initial load already set currentSong correctly.
      // Server's song data can be stale due to duration drift.
      setState(prev => ({
        ...prev,
        slot: data.slot,
        status: prev.status === 'dj-speaking' ? 'dj-speaking' : 'playing',
        error: null,
      }));
    }

    const remainingSeconds = data.duration - data.seekTo;
    const nextCheckMs = Math.min(remainingSeconds * 1000 + 2000, 30000);
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(syncToServerFn, nextCheckMs);
  }, [fetchNowPlaying, performCrossfade, startMonitor, generateDJClip, fadeVolume, createDJAudio, scheduleServerFallback]);

  // tuneIn — called from click handler
  const tuneIn = useCallback(() => {
    isActiveRef.current = true;

    const player = playerRef.current;
    const data = prefetchedRef.current;

    if (!player || !data) {
      setState(prev => ({ ...prev, status: 'loading', error: null }));
      syncToServerFn();
      return;
    }

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

    startMonitor();

    // Always play intro DJ clip — Suki greets every listener
    // Pass null as previousSong so the script API triggers intro mode
    djPlayedForRef.current = data.song.id;
    generateDJClip(data.slot, null as unknown as { title: string; artist: string }, data.song).then(async result => {
      if (!result || !isActiveRef.current) return;
      setState(prev => ({ ...prev, djScript: result.script, status: 'dj-speaking' }));
      await fadeVolume(12, 600);
      const { audio: _djAudio, done } = await createDJAudio(result.blob);
      await done;
      await new Promise(r => setTimeout(r, 400));
      await fadeVolume(80, 1000);
      if (isActiveRef.current) {
        setState(prev => ({ ...prev, status: 'playing', djScript: '' }));
      }
    });

    const remaining = data.duration - adjustedSeek;
    pollTimerRef.current = setTimeout(syncToServerFn, Math.min(remaining * 1000 + 2000, 30000));
    scheduleServerFallback(remaining);

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
  }, [fetchNowPlaying, syncToServerFn, startMonitor, generateDJClip, fadeVolume, createDJAudio, scheduleServerFallback]);

  // Handle YouTube video ending — safety net if crossfade didn't trigger in time
  const onPlayerEnd = useCallback(() => {
    if (!isActiveRef.current) return;

    // If a crossfade is already in progress, it will handle the next song
    if (transitionInProgressRef.current) {
      console.log('[zo-fm] Video ended — crossfade already in progress');
      return;
    }

    console.log('[zo-fm] Video ended naturally — triggering crossfade as fallback');
    performCrossfade();
  }, [performCrossfade]);

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
      if (serverFallbackTimerRef.current) clearTimeout(serverFallbackTimerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    tuneIn,
    playerRef,
    onPlayerReady,
    onPlayerEnd,
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
