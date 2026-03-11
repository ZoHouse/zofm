'use client';

import { useCallback, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRadioSync } from '@/lib/useRadioSync';

const YouTube = dynamic(() => import('react-youtube').then(mod => mod.default), {
  ssr: false,
});

// Generate tick marks for the dial (frequency markings around the circle)
function generateTicks() {
  const ticks: { angle: number; major: boolean; label?: string }[] = [];
  const freqs = [80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108];
  const startAngle = -130; // degrees from top
  const endAngle = 130;
  const totalRange = endAngle - startAngle;

  // Major ticks with labels
  freqs.forEach((freq, i) => {
    const angle = startAngle + (i / (freqs.length - 1)) * totalRange;
    ticks.push({ angle, major: true, label: String(freq) });
  });

  // Minor ticks between majors
  for (let i = 0; i < freqs.length - 1; i++) {
    const a1 = startAngle + (i / (freqs.length - 1)) * totalRange;
    const a2 = startAngle + ((i + 1) / (freqs.length - 1)) * totalRange;
    const step = (a2 - a1) / 4;
    for (let j = 1; j < 4; j++) {
      ticks.push({ angle: a1 + step * j, major: false });
    }
  }

  return ticks;
}

export function RadioPlayer() {
  const { status, currentSong, slot, djScript, error, tuneIn, onPlayerReady } = useRadioSync();
  const [tunedIn, setTunedIn] = useState(false);
  const ticks = useMemo(() => generateTicks(), []);

  const isPlaying = status === 'playing' || status === 'dj-speaking';
  const isDJSpeaking = status === 'dj-speaking' && djScript;

  const handleTuneIn = useCallback(() => {
    setTunedIn(true);
    tuneIn();
  }, [tuneIn]);

  return (
    <div className="h-screen w-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: '#050505' }}>

      {/* Film grain */}
      <div className="grain" />

      {/* Hidden YouTube player */}
      <div className="fixed w-0 h-0 overflow-hidden opacity-0 pointer-events-none" aria-hidden="true">
        <YouTube
          opts={{
            height: '1',
            width: '1',
            playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, playsinline: 1 },
          }}
          onReady={onPlayerReady}
          onError={() => {}}
        />
      </div>

      {/* Top: DJ script only when speaking */}
      {isDJSpeaking && (
        <div className={`dj-overlay ${djScript ? 'visible' : ''}`}>
          &ldquo;{djScript}&rdquo;
        </div>
      )}

      {/* The Dial */}
      <div
        className="dial"
        onClick={!tunedIn ? handleTuneIn : undefined}
        role={!tunedIn ? 'button' : undefined}
        tabIndex={!tunedIn ? 0 : undefined}
      >
        <div className="dial-ring" />

        {/* Tick marks */}
        <div className="dial-ticks">
          {ticks.map((tick, i) => (
            <div
              key={i}
              className={`tick ${tick.major ? 'major' : ''}`}
              style={{ transform: `rotate(${tick.angle}deg)` }}
            >
              {tick.label && (
                <span
                  className="tick-label"
                  style={{ transform: `rotate(${-tick.angle}deg)` }}
                >
                  {tick.label}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Purple arc indicator */}
        <svg
          className={`dial-arc ${tunedIn ? 'visible' : ''}`}
          viewBox="0 0 100 100"
          style={{ position: 'absolute', inset: '3px' }}
        >
          <defs>
            <linearGradient id="arc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(167,139,250,0)" />
              <stop offset="40%" stopColor="rgba(167,139,250,0.25)" />
              <stop offset="60%" stopColor="rgba(167,139,250,0.4)" />
              <stop offset="100%" stopColor="rgba(167,139,250,0.08)" />
            </linearGradient>
          </defs>
          <circle
            cx="50" cy="50" r="48"
            fill="none"
            stroke="url(#arc-grad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="80 220"
            strokeDashoffset="30"
          />
        </svg>

        {/* Needle */}
        <div className={`dial-needle ${isPlaying ? 'playing' : ''}`} />

        {/* Center frequency display */}
        <div className="freq-display">
          <div className="freq-number">
            86<span className="decimal">.13</span>
          </div>
          <div className="freq-unit">kHz</div>
          {tunedIn && (
            <div className="freq-channel">ZO FM</div>
          )}
        </div>
      </div>

      {/* Bottom: song info or tune-in prompt */}
      {!tunedIn ? (
        <div className="tune-prompt">tune in</div>
      ) : error ? (
        <div className="error-msg" onClick={tuneIn}>
          {error}<br />
          <span style={{ opacity: 0.5 }}>tap to retry</span>
        </div>
      ) : (
        <div className={`song-info ${isPlaying && currentSong ? 'visible' : ''}`}>
          <div className="song-title">{currentSong?.title}</div>
          <div className="song-artist">{currentSong?.artist}</div>
        </div>
      )}
    </div>
  );
}
