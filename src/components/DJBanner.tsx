'use client';

import { ShowState } from '@/types/radio';

interface Props {
  state: ShowState;
  djScript: string;
  songTitle?: string;
  songArtist?: string;
}

const stateLabels: Record<ShowState, string> = {
  idle: 'Press play to start Zo FM',
  'picking-song': 'Picking next track...',
  'generating-script': 'DJ is thinking...',
  speaking: 'DJ is on air',
  'playing-song': 'Now Playing',
};

export function DJBanner({ state, djScript, songTitle, songArtist }: Props) {
  return (
    <div className="text-center space-y-4">
      <div className="text-white/50 text-sm uppercase tracking-widest">
        {stateLabels[state]}
      </div>

      {state === 'speaking' && djScript && (
        <div className="max-w-lg mx-auto bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/80 italic text-sm leading-relaxed">
            &ldquo;{djScript}&rdquo;
          </p>
        </div>
      )}

      {state === 'playing-song' && songTitle && (
        <div>
          <h2 className="text-2xl font-bold text-white">{songTitle}</h2>
          <p className="text-white/60 text-lg">{songArtist}</p>
        </div>
      )}
    </div>
  );
}
