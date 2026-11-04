import { expect, test } from 'vitest';
import narration from '../src/pitch/narration.json' with { type: 'json' };
import durations from '../src/pitch/vo-durations.json' with { type: 'json' };
import { DEMO_FRAMES, pitchScenes, PITCH_TOTAL, sentenceTimes } from '../src/pitch/timeline.ts';

test('the explainer runs about two minutes and leaves exactly one minute for the live demo', () => {
  const explainer = PITCH_TOTAL - DEMO_FRAMES;
  expect(DEMO_FRAMES).toBe(60 * 60);
  expect(explainer / 60).toBeGreaterThanOrEqual(110);
  expect(explainer / 60).toBeLessThanOrEqual(125);
  expect(pitchScenes.at(-1)!.id).toBe('demo');
  expect(pitchScenes.at(-1)!.from + pitchScenes.at(-1)!.duration).toBe(PITCH_TOTAL);
});

test('scenes follow the narration, contiguous, and each holds its whole voice clip', () => {
  const ids = narration.segments.map((s) => s.id);
  expect(pitchScenes.slice(0, -1).map((s) => s.id)).toEqual(ids);
  for (let i = 1; i < pitchScenes.length; i++) expect(pitchScenes[i]!.from).toBe(pitchScenes[i - 1]!.from + pitchScenes[i - 1]!.duration);
  for (const s of pitchScenes.slice(0, -1)) {
    const vo = (durations as Record<string, number>)[s.id]!;
    expect(s.voAt + vo * 60, s.id).toBeLessThanOrEqual(s.duration);
  }
});

test('subtitles cover every sentence of a segment in order, inside its voice clip', () => {
  for (const seg of narration.segments) {
    const times = sentenceTimes(seg.id);
    expect(times.map((t) => t.text).join(' ')).toBe(seg.text);
    for (let i = 1; i < times.length; i++) expect(times[i]!.at).toBeGreaterThan(times[i - 1]!.at);
    expect(times.at(-1)!.at).toBeLessThan((durations as Record<string, number>)[seg.id]! * 60);
  }
});

test('the glasses line describes a next step, not a shipped feature', () => {
  const glasses = narration.segments.find((s) => s.id === 'glasses')!.text;
  expect(glasses).toMatch(/\bnext\b/i);
  expect(glasses).not.toMatch(/works (on|with) (Meta's )?(camera )?glasses|available on glasses/i);
});
