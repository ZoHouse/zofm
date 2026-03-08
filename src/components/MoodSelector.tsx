'use client';

import { Mood } from '@/types/radio';

const moods: { value: Mood; label: string; emoji: string }[] = [
  { value: 'energetic', label: 'Energetic', emoji: '⚡' },
  { value: 'chill', label: 'Chill', emoji: '🌊' },
  { value: 'romantic', label: 'Romantic', emoji: '💜' },
  { value: 'party', label: 'Party', emoji: '🎉' },
  { value: 'focus', label: 'Focus', emoji: '🎯' },
  { value: 'late-night', label: 'Late Night', emoji: '🌙' },
];

interface Props {
  selected: Mood;
  onSelect: (mood: Mood) => void;
  disabled?: boolean;
}

export function MoodSelector({ selected, onSelect, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {moods.map(m => (
        <button
          key={m.value}
          onClick={() => onSelect(m.value)}
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all
            ${selected === m.value
              ? 'bg-white text-black scale-105'
              : 'bg-white/10 text-white/70 hover:bg-white/20'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {m.emoji} {m.label}
        </button>
      ))}
    </div>
  );
}
