'use client';

import { useState, useCallback, useRef } from 'react';
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);

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
    const { script } = await scriptRes.json();
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
    const blob = await ttsRes.blob();
    const url = URL.createObjectURL(blob);

    return new Promise<void>((resolve) => {
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
      audio.play().catch(() => resolve());
    });
  }, []);

  const startShow = useCallback(async () => {
    const mood = show.mood;
    const nextSong = getRandomSong(mood);

    setShow(prev => ({
      ...prev,
      isPlaying: true,
      nextSong,
      state: 'picking-song',
      error: null,
    }));

    try {
      await generateAndSpeak(mood, null, nextSong);

      // Restore volume and play song
      if (playerRef.current) {
        playerRef.current.setVolume(80);
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
  }, [show.mood, generateAndSpeak]);

  const onSongEnd = useCallback(async () => {
    const mood = show.mood;
    const previousSong = show.currentSong;
    const nextSong = getRandomSong(mood, previousSong?.id);

    setShow(prev => ({
      ...prev,
      nextSong,
      state: 'picking-song',
    }));

    try {
      await generateAndSpeak(mood, previousSong, nextSong);

      if (playerRef.current) {
        playerRef.current.setVolume(80);
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
  }, [show.mood, show.currentSong, generateAndSpeak]);

  const stopShow = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
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
