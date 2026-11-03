import type { ClientMessage } from '@fingerpost/protocol';

/** Local mock-phone diagnostic: counts validated boundaries without retaining payloads or text. */
export class TransportCounters {
  private pinActive = false;
  private readonly counts = {
    audioChunks: 0, audioChunksWhilePinActive: 0,
    audioEnds: 0, audioEndsWhilePinActive: 0,
    keyframes: 0, keyframesWhilePinActive: 0,
    pinEntered: 0, pinExited: 0,
  };

  record(message: ClientMessage): void {
    if (message.type === 'event' && message.kind === 'pinModeEntered') {
      this.pinActive = true; this.counts.pinEntered++; return;
    }
    if (message.type === 'event' && message.kind === 'pinModeExited') {
      this.pinActive = false; this.counts.pinExited++; return;
    }
    if (message.type === 'audio') {
      this.counts.audioChunks++;
      if (this.pinActive) this.counts.audioChunksWhilePinActive++;
    } else if (message.type === 'audio.end') {
      this.counts.audioEnds++;
      if (this.pinActive) this.counts.audioEndsWhilePinActive++;
    } else if (message.type === 'keyframe') {
      this.counts.keyframes++;
      if (this.pinActive) this.counts.keyframesWhilePinActive++;
    }
  }

  snapshot() { return { ...this.counts, pinActive: this.pinActive }; }
}
