import { DJPersona, Mood } from '@/types/radio';

export const personas: DJPersona[] = [
  {
    name: 'Zo Morning',
    voice: 'nova',
    style: 'Energetic and upbeat. Short punchy intros. Uses "Good morning, beautiful people!" energy.',
    moods: ['energetic'],
  },
  {
    name: 'Zo Chill',
    voice: 'echo',
    style: 'Smooth and relaxed. Speaks slowly. Uses "Sit back and let this one wash over you" vibes.',
    moods: ['chill', 'focus'],
  },
  {
    name: 'Zo Lover',
    voice: 'shimmer',
    style: 'Warm and intimate. Whisper-like energy. Talks about love, memories, and feelings.',
    moods: ['romantic'],
  },
  {
    name: 'Zo Party',
    voice: 'onyx',
    style: 'Hype and bold. Deep voice, big energy. Uses "Let\'s gooo!" and "Turn it up!" catchphrases.',
    moods: ['party'],
  },
  {
    name: 'Zo Night',
    voice: 'fable',
    style: 'Mysterious and reflective. British accent energy. Talks about the night, stars, and solitude.',
    moods: ['late-night'],
  },
];

export function getPersonaForMood(mood: Mood): DJPersona {
  const match = personas.find(p => p.moods.includes(mood));
  return match ?? personas[0];
}
