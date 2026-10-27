/** Micro-dollars (µ$) per unit at Standard prices (docs/design.md §4.5). Integers so counters never drift. */
export const PRICE = { sparkInPerTok: 1.25, sparkOutPerTok: 4.25, samImage: 2500, samVideoFrame: 200, samVideoMinFrames: 50, asrPerSecond: 50 } as const;

export type Usage =
  | { kind: 'spark'; inputTokens: number; outputTokens: number }
  | { kind: 'sam_image'; images: number }
  | { kind: 'sam_video'; frames: number }
  | { kind: 'asr'; seconds: number };

export function costMicros(u: Usage): number {
  switch (u.kind) {
    case 'spark': return Math.ceil(u.inputTokens * PRICE.sparkInPerTok + u.outputTokens * PRICE.sparkOutPerTok);
    case 'sam_image': return u.images * PRICE.samImage;
    case 'sam_video': return Math.max(PRICE.samVideoMinFrames, u.frames) * PRICE.samVideoFrame;
    case 'asr': return Math.floor(u.seconds) * PRICE.asrPerSecond; // billed in whole seconds, rounded down
  }
}
