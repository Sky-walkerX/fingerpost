import { expect, test } from 'vitest';
import beats from '../src/beats.json' with { type: 'json' };
import { beatsWithin, musicVolume, scenes, TOTAL_FRAMES } from '../src/timeline.ts';

const ORDER = ['problem', 'answer', 'scan', 'confirm', 'guide', 'privacy', 'close'];

test('fits 40 to 50 seconds at 60 fps with contiguous scenes in story order', () => {
  expect(TOTAL_FRAMES / 60).toBeGreaterThanOrEqual(40);
  expect(TOTAL_FRAMES / 60).toBeLessThanOrEqual(50);
  expect(scenes.map((s) => s.id)).toEqual(ORDER);
  expect(scenes[0]!.from).toBe(0);
  for (let i = 1; i < scenes.length; i++) expect(scenes[i]!.from).toBe(scenes[i - 1]!.from + scenes[i - 1]!.duration);
  expect(scenes.at(-1)!.from + scenes.at(-1)!.duration).toBe(TOTAL_FRAMES);
});

test('problem is 3 to 5 seconds', () => {
  expect(scenes[0]!.duration).toBeGreaterThanOrEqual(180);
  expect(scenes[0]!.duration).toBeLessThanOrEqual(300);
});

test('every boundary sits on a beat', () => {
  for (const s of scenes.slice(1)) {
    expect(beats.beats.some((b) => Math.abs(b * 60 - s.from) <= 1), `${s.id} at ${s.from}`).toBe(true);
  }
});

test('music fades out and never stops early', () => {
  expect(musicVolume(0)).toBeGreaterThan(0);
  expect(musicVolume(TOTAL_FRAMES - 1)).toBeLessThan(0.05);
  for (let f = TOTAL_FRAMES - 90; f < TOTAL_FRAMES - 1; f++) expect(musicVolume(f + 1)).toBeLessThanOrEqual(musicVolume(f));
  expect(beats.beats.at(-1)! + 60 / beats.bpm).toBeGreaterThanOrEqual(TOTAL_FRAMES / 60);
});

test('beatsWithin gives scene-relative beat frames inside the scene', () => {
  for (const s of scenes) {
    const local = beatsWithin(s.id);
    expect(local.length, s.id).toBeGreaterThan(0);
    for (const f of local) { expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThan(s.duration); }
  }
});
