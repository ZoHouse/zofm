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
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const djPlayedForRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isActiveRef = useRef(false);
  const prefetchedRef = useRef<NowPlayingData | null>(null);
  const playerReadyRef = useRef(false);

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

  // Prefetch now-playing data on mount so we can play instantly on click
  useEffect(() => {
    let cancelled = false;
    fetchNowPlaying().then(data => {
      if (cancelled || !data) return;
      prefetchedRef.current = data;
      setState(prev => ({
        ...prev,
        status: 'ready',
        slot: data.slot,
      }));
    });
    return () => { cancelled = true; };
  }, [fetchNowPlaying]);

  const playDJClip = useCallback(async (data: NowPlayingData): Promise<void> => {
    if (djPlayedForRef.current === data.song.id) return;
    if (data.seekTo > 10) return;

    djPlayedForRef.current = data.song.id;

    try {
      if (playerRef.current) playerRef.current.setVolume(8);
      setState(prev => ({ ...prev, status: 'dj-speaking' }));

      const scriptRes = await fetch('/api/dj/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: data.slot.mood,
          previousSong: data.previousSong,
          nextSong: data.song,
          djName: data.slot.djName,
          djStyle: getDJStyle(data.slot.mood),
        }),
      });

      if (!scriptRes.ok) throw new Error('DJ script failed');
      const { script } = await scriptRes.json();

      if (!isActiveRef.current) return;
      setState(prev => ({ ...prev, djScript: script }));

      const ttsRes = await fetch('/api/dj/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, voice: data.slot.voice }),
      });

      if (!ttsRes.ok) throw new Error('TTS failed');
      if (!isActiveRef.current) return;

      const blob = await ttsRes.blob();
      const url = URL.createObjectURL(blob);

      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audioRef.current = audio;
        // Boost DJ voice volume
        audio.volume = 1.0;
        try {
          const ctx = new AudioContext();
          const source = ctx.createMediaElementSource(audio);
          const gain = ctx.createGain();
          gain.gain.value = 2.5; // 2.5x louder
          source.connect(gain);
          gain.connect(ctx.destination);
        } catch {
          // Web Audio API not available — plays at normal volume
        }
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => { URL.revokeObjectURL(url); resolve(); });
      });
    } catch {
      // DJ clip is non-critical
    } finally {
      if (playerRef.current) playerRef.current.setVolume(80);
      if (isActiveRef.current) {
        setState(prev => ({ ...prev, status: 'playing', djScript: '' }));
      }
    }
  }, []);

  const syncToServer = useCallback(async () => {
    if (!isActiveRef.current) return;

    const data = await fetchNowPlaying();
    if (!data || !isActiveRef.current) return;

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
      currentSongIdRef.current = data.song.id;
      player.loadVideoById({ videoId: data.song.id, startSeconds: data.seekTo });
      playDJClip(data);

      // Stall detection: if not playing after 6s, skip to next sync
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(() => {
        if (!isActiveRef.current || !playerRef.current) return;
        const state = playerRef.current.getPlayerState();
        // -1=unstarted, 0=ended, 2=paused, 5=cued — all bad
        if (state !== 1 && state !== 3) {
          console.log('[zo-fm] Song stalled, re-syncing...');
          syncToServer();
        }
      }, 6000);
    }

    const remainingSeconds = data.duration - data.seekTo;
    const nextCheckMs = Math.min(remainingSeconds * 1000 + 2000, 30000);
    pollTimerRef.current = setTimeout(syncToServer, nextCheckMs);
  }, [fetchNowPlaying, playDJClip]);

  // tuneIn is called SYNCHRONOUSLY from click handler — must play immediately
  const tuneIn = useCallback(() => {
    isActiveRef.current = true;

    const player = playerRef.current;
    const data = prefetchedRef.current;

    if (!player || !data) {
      // Player or data not ready yet — fall back to async
      setState(prev => ({ ...prev, status: 'loading', error: null }));
      fetchNowPlaying().then(freshData => {
        if (!freshData) return;
        setState({
          status: 'playing',
          currentSong: freshData.song,
          slot: freshData.slot,
          djScript: '',
          error: null,
        });
        currentSongIdRef.current = freshData.song.id;
        if (playerRef.current) {
          playerRef.current.loadVideoById({ videoId: freshData.song.id, startSeconds: freshData.seekTo });
          playerRef.current.setVolume(80);
        }
        playDJClip(freshData);
        const remaining = freshData.duration - freshData.seekTo;
        pollTimerRef.current = setTimeout(syncToServer, Math.min(remaining * 1000 + 2000, 30000));
      });
      return;
    }

    // IMMEDIATE — within user gesture context
    // Re-fetch seekTo since prefetch may be stale, but use same song ID
    // The seekTo drift is at most a few seconds — acceptable
    const elapsed = Math.floor((Date.now() - data.serverTime) / 1000);
    const adjustedSeek = data.seekTo + elapsed;

    currentSongIdRef.current = data.song.id;
    player.loadVideoById({ videoId: data.song.id, startSeconds: adjustedSeek });
    player.setVolume(80);

    setState({
      status: 'playing',
      currentSong: data.song,
      slot: data.slot,
      djScript: '',
      error: null,
    });

    // Fire DJ clip in background (non-blocking)
    playDJClip({ ...data, seekTo: adjustedSeek });

    // Start polling for next song
    const remaining = data.duration - adjustedSeek;
    pollTimerRef.current = setTimeout(syncToServer, Math.min(remaining * 1000 + 2000, 30000));

    // Also do a fresh fetch to correct any drift
    fetchNowPlaying().then(fresh => {
      if (!fresh || !isActiveRef.current) return;
      if (fresh.song.id !== currentSongIdRef.current) {
        // Song actually changed — correct it
        currentSongIdRef.current = fresh.song.id;
        if (playerRef.current) {
          playerRef.current.loadVideoById({ videoId: fresh.song.id, startSeconds: fresh.seekTo });
        }
        setState(prev => ({ ...prev, currentSong: fresh.song, slot: fresh.slot }));
      }
    });
  }, [fetchNowPlaying, playDJClip, syncToServer]);

  const onPlayerReady = useCallback((event: { target: YT.Player }) => {
    playerRef.current = event.target;
    playerReadyRef.current = true;
    event.target.setVolume(80);
  }, []);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
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
