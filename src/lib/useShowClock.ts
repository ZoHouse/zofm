'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Song, Mood, ShowState } from '@/types/radio';
import { getRandomSong } from '@/data/songs';
import { getPersonaForMood } from '@/data/personas';

interface ShowClockState {
  state: ShowState;
  currentSong: Song | null;
  nextSong: Song | null;
  djScript: string;
  mood: Mood;
  isPlaying: boolean;
  error: string | null;
}

export function useShowClock() {
  const [show, setShow] = useState<ShowClockState>({
    state: 'idle',
    currentSong: null,
    nextSong: null,
    djScript: '',
    mood: 'chill',
    isPlaying: false,
    error: null,
  });

  // Refs to avoid stale closures in async callbacks
  const moodRef = useRef(show.mood);
  const currentSongRef = useRef(show.currentSong);
  const isPlayingRef = useRef(show.isPlaying);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const stoppedRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { moodRef.current = show.mood; }, [show.mood]);
  useEffect(() => { currentSongRef.current = show.currentSong; }, [show.currentSong]);
  useEffect(() => { isPlayingRef.current = show.isPlaying; }, [show.isPlaying]);

  const setMood = useCallback((mood: Mood) => {
    setShow(prev => ({ ...prev, mood }));
  }, []);

  const generateAndSpeak = useCallback(async (mood: Mood, previousSong: Song | null, nextSong: Song) => {
    const persona = getPersonaForMood(mood);

    // Generate DJ script
    setShow(prev => ({ ...prev, state: 'generating-script' }));
    const scriptRes = await fetch('/api/dj/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mood,
        previousSong,
        nextSong,
        djName: persona.name,
        djStyle: persona.style,
      }),
    });

    if (!scriptRes.ok) {
      throw new Error(`DJ script generation failed: ${scriptRes.status}`);
    }

    const { script, error } = await scriptRes.json();
    if (error || !script) {
      throw new Error(error || 'Empty DJ script returned');
    }

    if (stoppedRef.current) return;

    setShow(prev => ({ ...prev, djScript: script, state: 'speaking' }));

    // Duck YouTube volume
    if (playerRef.current) {
      playerRef.current.setVolume(15);
    }

    // Generate and play TTS
    const ttsRes = await fetch('/api/dj/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: script, voice: persona.voice }),
    });

    if (!ttsRes.ok) {
      throw new Error(`TTS generation failed: ${ttsRes.status}`);
    }

    if (stoppedRef.current) return;

    const blob = await ttsRes.blob();
    const url = URL.createObjectURL(blob);

    return new Promise<void>((resolve) => {
      if (stoppedRef.current) {
        URL.revokeObjectURL(url);
        resolve();
        return;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(); // Continue even if TTS fails
      };
      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        resolve();
      });
    });
  }, []);

  const startShow = useCallback(async () => {
    const mood = moodRef.current;
    const nextSong = getRandomSong(mood);
    stoppedRef.current = false;

    setShow(prev => ({
      ...prev,
      isPlaying: true,
      nextSong,
      state: 'picking-song',
      error: null,
    }));

    try {
      await generateAndSpeak(mood, null, nextSong);

      if (stoppedRef.current) return;

      // Restore volume and play song via loadVideoById (persistent player)
      if (playerRef.current) {
        playerRef.current.setVolume(80);
        playerRef.current.loadVideoById(nextSong.id);
      }
      setShow(prev => ({
        ...prev,
        currentSong: nextSong,
        nextSong: null,
        state: 'playing-song',
      }));
    } catch (err) {
      setShow(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Something went wrong',
        state: 'idle',
        isPlaying: false,
      }));
    }
  }, [generateAndSpeak]);

  const onSongEnd = useCallback(async () => {
    if (stoppedRef.current || !isPlayingRef.current) return;

    const mood = moodRef.current;
    const previousSong = currentSongRef.current;
    const nextSong = getRandomSong(mood, previousSong?.id);

    setShow(prev => ({
      ...prev,
      nextSong,
      state: 'picking-song',
    }));

    try {
      await generateAndSpeak(mood, previousSong, nextSong);

      if (stoppedRef.current) return;

      if (playerRef.current) {
        playerRef.current.setVolume(80);
        playerRef.current.loadVideoById(nextSong.id);
      }
      setShow(prev => ({
        ...prev,
        currentSong: nextSong,
        nextSong: null,
        state: 'playing-song',
      }));
    } catch (err) {
      setShow(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Something went wrong',
        state: 'idle',
        isPlaying: false,
      }));
    }
  }, [generateAndSpeak]);

  const stopShow = useCallback(() => {
    stoppedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.stopVideo();
    }
    setShow(prev => ({
      ...prev,
      state: 'idle',
      isPlaying: false,
      currentSong: null,
      nextSong: null,
      djScript: '',
    }));
  }, []);

  return {
    ...show,
    setMood,
    startShow,
    stopShow,
    onSongEnd,
    playerRef,
  };
}
