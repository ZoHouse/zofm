// src/lib/scheduler.ts

import { computeTimeline, getCurrentEntry, getCurrentSlot } from './timeline';
import { getSSEManager } from './sse-manager';
import { saveDJClip, getDJClipForTransition, pruneOldClips } from './db';
import type { Timeline, TimelineEntry, RadioEvent } from './types';
import crypto from 'crypto';

// DJ style descriptions (same as client-side getDJStyle, used for script generation)
const DJ_STYLES: Record<string, string> = {
  energetic: 'Morning energy at a Zo House. You sound like the first person up making chai for everyone. Warm, excited, ready to build.',
  chill: 'Midday wind-down vibes. You sound like someone on the common room couch after a productive morning.',
  focus: 'Deep work hours. You are the quietest DJ — minimal words, maximum respect for concentration. Almost whisper-like.',
  romantic: 'Pre-dawn intimacy. You sound like a late-night conversation on the rooftop that got deep.',
  party: 'Evening gathering energy. You sound like the one who just connected the aux at a Zo House party. Bold, warm, inclusive.',
  'late-night': 'Post-midnight philosopher. You sound like the last three people awake in the kitchen having the realest conversation.',
};

function getBaseUrl(): string {
  return `http://localhost:${process.env.PORT || 3000}`;
}

class RadioScheduler {
  private timeline: Timeline | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private slotCheckTimer: ReturnType<typeof setInterval> | null = null;
  private currentSlotName: string = '';
  private generatingFor: Set<string> = new Set();

  start(): void {
    console.log('[zo-radio-scheduler] Starting...');
    this.refresh();

    // Check for slot changes every 30s
    this.slotCheckTimer = setInterval(() => {
      const slot = getCurrentSlot();
      if (slot.name !== this.currentSlotName) {
        console.log(`[zo-radio-scheduler] Slot changed: ${this.currentSlotName} -> ${slot.name}`);
        this.refresh();
      }
    }, 30_000);

    // Heartbeat every 30s to keep SSE connections alive
    this.heartbeatTimer = setInterval(() => {
      const event: RadioEvent = {
        type: 'heartbeat',
        data: { serverTime: new Date().toISOString() },
      };
      getSSEManager().broadcast(event);
    }, 30_000);

    // Prune old clips every hour
    setInterval(() => {
      try { pruneOldClips(); } catch { /* non-critical */ }
    }, 3600_000);
  }

  refresh(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];

    this.timeline = computeTimeline();
    if (!this.timeline) {
      console.error('[zo-radio-scheduler] No timeline — no songs available');
      return;
    }

    this.currentSlotName = this.timeline.slot.name;
    console.log(`[zo-radio-scheduler] Timeline computed: ${this.timeline.entries.length} entries for ${this.currentSlotName}`);

    const currentEntry = getCurrentEntry(this.timeline);
    if (currentEntry) {
      const event: RadioEvent = {
        type: 'slot-change',
        data: { slot: this.timeline.slot, firstEntry: currentEntry },
      };
      getSSEManager().broadcast(event);
    }

    const now = Date.now();
    for (const entry of this.timeline.entries) {
      this.scheduleEntryEvents(entry, now);
    }
  }

  private scheduleEntryEvents(entry: TimelineEntry, now: number): void {
    const songStartMs = new Date(entry.startTime).getTime() - now;
    const songEndMs = new Date(entry.endTime).getTime() - now;

    if (songEndMs < 0) return;

    if (songStartMs > 0) {
      this.timers.push(setTimeout(() => {
        const event: RadioEvent = {
          type: 'song-start',
          data: { entry },
        };
        getSSEManager().broadcast(event);
        console.log(`[zo-radio-scheduler] song-start: "${entry.song.title}" by ${entry.song.artist}`);
      }, songStartMs));
    }

    if (songEndMs > 0) {
      this.timers.push(setTimeout(() => {
        const nextSongId = entry.djBreak?.nextSong.id || '';
        const event: RadioEvent = {
          type: 'song-end',
          data: { songId: entry.song.id, nextSongId },
        };
        getSSEManager().broadcast(event);
      }, songEndMs));
    }

    if (entry.djBreak) {
      const prefetchMs = new Date(entry.djBreak.windowStart).getTime() - now;
      const djPlayMs = songEndMs - 15_000;

      if (prefetchMs > 0) {
        this.timers.push(setTimeout(() => {
          this.generateDJClip(entry);
        }, prefetchMs));
      } else if (songEndMs > 20_000) {
        this.generateDJClip(entry);
      }

      if (djPlayMs > 0) {
        this.timers.push(setTimeout(() => {
          this.broadcastDJBreak(entry);
        }, djPlayMs));
      }
    }
  }

  private async generateDJClip(entry: TimelineEntry): Promise<void> {
    if (!entry.djBreak) return;
    const transitionKey = `${entry.song.id}->${entry.djBreak.nextSong.id}`;
    if (this.generatingFor.has(transitionKey)) return;
    this.generatingFor.add(transitionKey);

    try {
      // Check cache first
      const cached = getDJClipForTransition(entry.song.id, entry.djBreak.nextSong.id);
      if (cached) {
        entry.djBreak.clipId = cached.id;
        console.log(`[zo-radio-scheduler] DJ clip cache hit: ${cached.id}`);
        const event: RadioEvent = {
          type: 'dj-break-ready',
          data: {
            clipId: cached.id,
            clipUrl: `/api/dj/clip/${cached.id}`,
            script: cached.script,
            forNextSongId: entry.djBreak.nextSong.id,
          },
        };
        getSSEManager().broadcast(event);
        return;
      }

      const slot = getCurrentSlot();
      const baseUrl = getBaseUrl();

      // Generate script via internal API
      const scriptRes = await fetch(`${baseUrl}/api/dj/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: slot.mood,
          previousSong: { title: entry.song.title, artist: entry.song.artist },
          nextSong: { title: entry.djBreak.nextSong.title, artist: entry.djBreak.nextSong.artist },
          djName: slot.djName,
          djStyle: DJ_STYLES[slot.mood] || DJ_STYLES.chill,
        }),
      });
      if (!scriptRes.ok) {
        console.error(`[zo-radio-scheduler] Script API failed: ${scriptRes.status}`);
        return;
      }
      const { script } = await scriptRes.json();

      // Generate TTS via internal API
      const ttsRes = await fetch(`${baseUrl}/api/dj/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, voice: slot.voice }),
      });
      if (!ttsRes.ok) {
        console.error(`[zo-radio-scheduler] TTS API failed: ${ttsRes.status}`);
        return;
      }
      const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

      // Save to cache
      const clipId = crypto.randomUUID();
      saveDJClip(
        clipId,
        entry.song.id,
        entry.djBreak.nextSong.id,
        slot.name,
        slot.mood,
        script,
        audioBuffer
      );
      entry.djBreak.clipId = clipId;

      console.log(`[zo-radio-scheduler] DJ clip generated: ${clipId} (${audioBuffer.length} bytes)`);

      const event: RadioEvent = {
        type: 'dj-break-ready',
        data: {
          clipId,
          clipUrl: `/api/dj/clip/${clipId}`,
          script,
          forNextSongId: entry.djBreak.nextSong.id,
        },
      };
      getSSEManager().broadcast(event);
    } catch (err) {
      console.error(`[zo-radio-scheduler] DJ clip generation failed:`, err);
    } finally {
      this.generatingFor.delete(transitionKey);
    }
  }

  private broadcastDJBreak(entry: TimelineEntry): void {
    if (!entry.djBreak || !entry.djBreak.clipId) {
      console.log('[zo-radio-scheduler] DJ break skipped — no clip available');
      return;
    }

    const event: RadioEvent = {
      type: 'dj-break-start',
      data: {
        clipId: entry.djBreak.clipId,
        clipUrl: `/api/dj/clip/${entry.djBreak.clipId}`,
        script: '',
        nextSong: entry.djBreak.nextSong,
        duckMusicTo: 10,
      },
    };
    getSSEManager().broadcast(event);
    console.log(`[zo-radio-scheduler] dj-break-start: transition to "${entry.djBreak.nextSong.title}"`);
  }

  getTimeline(): Timeline | null {
    return this.timeline;
  }
}

// Module-level singleton
let _scheduler: RadioScheduler | null = null;

export function getScheduler(): RadioScheduler {
  if (!_scheduler) {
    _scheduler = new RadioScheduler();
    _scheduler.start();
  }
  return _scheduler;
}
