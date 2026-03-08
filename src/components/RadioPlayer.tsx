'use client';

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
    stopShow,
    onSongEnd,
    playerRef,
  } = useShowClock();

  const handleReady = (event: { target: YT.Player }) => {
    playerRef.current = event.target;
    if (currentSong) {
      event.target.setVolume(80);
    }
  };

  const handleStateChange = (event: { data: number }) => {
    // YouTube.PlayerState.ENDED === 0
    if (event.data === 0 && isPlaying) {
      onSongEnd();
    }
  };

  const handleError = () => {
    // Skip unplayable videos
    if (isPlaying) {
      onSongEnd();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-black to-zinc-900 flex flex-col items-center justify-center p-8 gap-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-5xl font-black text-white tracking-tight">
          ZO<span className="text-purple-400">FM</span>
        </h1>
        <p className="text-white/40 text-sm mt-1">AI Radio DJ</p>
      </div>

      {/* DJ Banner */}
      <DJBanner
        state={state}
        djScript={djScript}
        songTitle={currentSong?.title}
        songArtist={currentSong?.artist}
      />

      {/* Mood Selector */}
      <MoodSelector
        selected={mood}
        onSelect={setMood}
        disabled={isPlaying}
      />

      {/* Play/Stop Button */}
      <button
        onClick={isPlaying ? stopShow : startShow}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all
          ${isPlaying
            ? 'bg-red-500/20 border-2 border-red-500 hover:bg-red-500/30'
            : 'bg-purple-500/20 border-2 border-purple-500 hover:bg-purple-500/30'}
        `}
      >
        {isPlaying ? (
          <div className="w-6 h-6 bg-red-500 rounded-sm" />
        ) : (
          <div className="w-0 h-0 border-t-[12px] border-b-[12px] border-l-[20px] border-transparent border-l-purple-500 ml-1" />
        )}
      </button>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {/* Hidden YouTube Player */}
      {currentSong && (
        <div className="absolute -left-[9999px]">
          <YouTube
            videoId={currentSong.id}
            opts={{
              height: '1',
              width: '1',
              playerVars: {
                autoplay: 1,
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
      )}
    </div>
  );
}
