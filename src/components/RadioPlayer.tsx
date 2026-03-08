'use client';

import { useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useShowClock } from '@/lib/useShowClock';
import { MoodSelector } from './MoodSelector';
import { DJBanner } from './DJBanner';

const YouTube = dynamic(() => import('react-youtube').then(mod => mod.default), {
  ssr: false,
});

export function RadioPlayer() {
  const {
    state,
    currentSong,
    mood,
    djScript,
    isPlaying,
    error,
    setMood,
    startShow,
    onSongEnd,
    playerRef,
  } = useShowClock();

  const [tunedIn, setTunedIn] = useState(false);

  // Use refs for stable callbacks passed to YouTube component
  const onSongEndRef = useRef(onSongEnd);
  onSongEndRef.current = onSongEnd;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const handleTuneIn = useCallback(() => {
    setTunedIn(true);
    startShow();
  }, [startShow]);

  const handleReady = useCallback((event: { target: YT.Player }) => {
    playerRef.current = event.target;
    event.target.setVolume(80);
  }, [playerRef]);

  const handleStateChange = useCallback((event: { data: number }) => {
    if (event.data === 0 && isPlayingRef.current) {
      onSongEndRef.current();
    }
  }, []);

  const handleError = useCallback(() => {
    if (isPlayingRef.current) {
      onSongEndRef.current();
    }
  }, []);

  // Pre-tune-in: full-screen "Tune In" splash
  if (!tunedIn) {
    return (
      <div
        onClick={handleTuneIn}
        className="min-h-screen bg-gradient-to-b from-zinc-900 via-black to-zinc-900 flex flex-col items-center justify-center p-8 cursor-pointer select-none"
      >
        <div className="text-center space-y-6 animate-pulse">
          <h1 className="text-6xl font-black text-white tracking-tight">
            ZO<span className="text-purple-400">FM</span>
          </h1>
          <p className="text-white/50 text-lg uppercase tracking-[0.3em]">
            Tap anywhere to tune in
          </p>
        </div>
      </div>
    );
  }

  // Tuned in: the radio experience
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-black to-zinc-900 flex flex-col items-center justify-center p-8 gap-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-5xl font-black text-white tracking-tight">
          ZO<span className="text-purple-400">FM</span>
        </h1>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <p className="text-white/50 text-sm uppercase tracking-widest">Live</p>
        </div>
      </div>

      {/* DJ Banner */}
      <DJBanner
        state={state}
        djScript={djScript}
        songTitle={currentSong?.title}
        songArtist={currentSong?.artist}
      />

      {/* Mood Selector — always available to switch vibes */}
      <MoodSelector
        selected={mood}
        onSelect={setMood}
        disabled={false}
      />

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {/* Persistent YouTube Player */}
      <div className="absolute -left-[9999px]">
        <YouTube
          opts={{
            height: '1',
            width: '1',
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
            },
          }}
          onReady={handleReady}
          onStateChange={handleStateChange}
          onError={handleError}
        />
      </div>
    </div>
  );
}
