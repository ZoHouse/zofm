// Time-of-day schedule in IST (UTC+5:30)
// Determines mood based on current hour

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const slots = [
  { name: 'Morning Buzz',        mood: 'energetic',  startHour: 6,  endHour: 10, voice: 'nova',    djName: 'Zo Morning' },
  { name: 'Chill Hours',         mood: 'chill',      startHour: 10, endHour: 14, voice: 'echo',    djName: 'Zo Chill' },
  { name: 'Focus Zone',          mood: 'focus',      startHour: 14, endHour: 18, voice: 'echo',    djName: 'Zo Chill' },
  { name: 'Evening Vibes',       mood: 'party',      startHour: 18, endHour: 22, voice: 'onyx',    djName: 'Zo Party' },
  { name: 'Late Night Sessions', mood: 'late-night', startHour: 22, endHour: 26, voice: 'fable',   djName: 'Zo Night' },  // 26 = 2am next day
  { name: 'Midnight Melodies',   mood: 'romantic',   startHour: 2,  endHour: 6,  voice: 'shimmer', djName: 'Zo Lover' },
];

export function getISTHour() {
  const now = new Date();
  const istTime = new Date(now.getTime() + IST_OFFSET_MS + now.getTimezoneOffset() * 60000);
  return istTime.getHours();
}

export function getCurrentSlot() {
  const hour = getISTHour();
  // Handle the 22-02 wrap-around
  for (const slot of slots) {
    if (slot.startHour <= slot.endHour) {
      if (hour >= slot.startHour && hour < slot.endHour) return slot;
    } else {
      // Wraps past midnight (e.g., 22-26 means 22-02)
      if (hour >= slot.startHour || hour < (slot.endHour % 24)) return slot;
    }
  }
  // Fallback
  return slots[0];
}

// Seeded shuffle — deterministic for a given date + slot
export function seededShuffle(arr, seed) {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = ((s >>> 0) % (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getDaySeed() {
  const now = new Date();
  const istTime = new Date(now.getTime() + IST_OFFSET_MS + now.getTimezoneOffset() * 60000);
  const dateStr = istTime.toISOString().slice(0, 10).replace(/-/g, '');
  return parseInt(dateStr, 10);
}
