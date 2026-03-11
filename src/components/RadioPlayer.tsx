'use client';

import { useCallback, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRadioSync } from '@/lib/useRadioSync';

const YouTube = dynamic(() => import('react-youtube').then(mod => mod.default), {
  ssr: false,
});

function generateTicks() {
  const ticks: { angle: number; major: boolean; label?: string }[] = [];
  const freqs = [80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108];
  const startAngle = -130;
  const endAngle = 130;
  const totalRange = endAngle - startAngle;

  freqs.forEach((freq, i) => {
    const angle = startAngle + (i / (freqs.length - 1)) * totalRange;
    ticks.push({ angle, major: true, label: String(freq) });
  });

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
    <div className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden"
         style={{ background: '#080808' }}>

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

      {/* DJ speaks — no visual, audio only */}

      {/* The Chrome Dial */}
      <div
        className="dial"
        onClick={!tunedIn ? handleTuneIn : undefined}
        role={!tunedIn ? 'button' : undefined}
        tabIndex={!tunedIn ? 0 : undefined}
      >
        {/* Chrome bezel ring */}
        <div className="dial-bezel" />

        {/* Dark inner face */}
        <div className="dial-face" />

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

        {/* Needle */}
        <div className="dial-needle">
          <div className={`dial-needle-arm ${isPlaying ? 'playing' : ''}`} />
        </div>

        {/* 3D Chrome Knob — center */}
        <div className="knob-outer">
          <div className="knob-face">
            <span className="knob-label">ZO</span>
          </div>
        </div>

        {/* 86.13 inside the dial, below the knob */}
        <div className="freq-inside">
          <div className="freq-number">
            86<span className="decimal">.13</span>
          </div>
          <div className="freq-unit">kHz</div>
        </div>

      </div>

      {/* Song info / tune-in below dial */}
      <div className="below-dial">
        {!tunedIn ? (
          <div className="tune-prompt-inline">tune in</div>
        ) : error ? (
          <div className="error-msg-inline" onClick={tuneIn}>
            {error} &middot; <span style={{ opacity: 0.5 }}>tap to retry</span>
          </div>
        ) : isPlaying && currentSong ? (
          <div className="song-info-inline visible">
            <div className="song-title">{currentSong.title}</div>
            <div className="song-artist">{currentSong.artist}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
