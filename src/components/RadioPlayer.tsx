'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRadioSync } from '@/lib/useRadioSync';

const YouTube = dynamic(() => import('react-youtube').then(mod => mod.default), {
  ssr: false,
});

export function RadioPlayer() {
  const { status, currentSong, slot, djScript, error, tuneIn, onPlayerReady } = useRadioSync();
  const [tunedIn, setTunedIn] = useState(false);

  const handleTuneIn = useCallback(() => {
    setTunedIn(true);
    // tuneIn() is synchronous — plays immediately within user gesture
    tuneIn();
  }, [tuneIn]);

  const handleError = useCallback(() => {
    // YouTube error — sync will pick up next song automatically
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-black to-zinc-900 flex flex-col items-center justify-center">
      {/* YouTube player — always mounted so it's ready before tune-in */}
      <div className="fixed w-0 h-0 overflow-hidden opacity-0 pointer-events-none" aria-hidden="true">
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
              playsinline: 1,
            },
          }}
          onReady={onPlayerReady}
          onError={handleError}
        />
      </div>

      {!tunedIn ? (
        /* --- Splash screen --- */
        <div
          onClick={handleTuneIn}
          className="flex flex-col items-center justify-center cursor-pointer select-none p-8"
        >
          <div className="text-center space-y-6">
            <h1 className="text-7xl font-black text-white tracking-tight">
              ZO<span className="text-purple-400">FM</span>
            </h1>
            {slot && (
              <p className="text-white/30 text-xs uppercase tracking-[0.2em]">
                {slot.name}
              </p>
            )}
            <div className="animate-pulse">
              <p className="text-white/40 text-lg uppercase tracking-[0.3em]">
                Tap to tune in
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* --- Radio UI --- */
        <div className="flex flex-col items-center justify-center p-8">
          {/* Logo */}
          <h1 className="text-5xl font-black text-white tracking-tight mb-2">
            ZO<span className="text-purple-400">FM</span>
          </h1>

          {/* Live indicator */}
          <div className="flex items-center gap-2 mb-10">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-white/50 text-xs uppercase tracking-[0.2em]">
              {slot ? slot.name : 'Connecting...'}
            </p>
          </div>

          {/* Now playing card */}
          <div className="w-full max-w-sm bg-white/5 backdrop-blur rounded-2xl p-6 text-center space-y-4">
            {status === 'loading' && (
              <p className="text-white/40 text-sm">Tuning in...</p>
            )}

            {status === 'dj-speaking' && (
              <>
                <p className="text-purple-400 text-xs uppercase tracking-widest font-medium">
                  {slot?.djName} on air
                </p>
                <p className="text-white/70 text-sm italic leading-relaxed">
                  &ldquo;{djScript}&rdquo;
                </p>
              </>
            )}

            {(status === 'playing' || status === 'dj-speaking') && currentSong && (
              <>
                <p className="text-white text-xl font-bold leading-tight">
                  {currentSong.title}
                </p>
                <p className="text-white/50 text-sm">
                  {currentSong.artist}
                </p>
              </>
            )}

            {status === 'error' && (
              <div className="space-y-2">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={tuneIn}
                  className="text-purple-400 text-sm underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Equalizer bars animation */}
          {status === 'playing' && (
            <div className="flex items-end gap-1 mt-8 h-8">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="w-1 bg-purple-400/60 rounded-full"
                  style={{
                    animation: `equalizer ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
