import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import narration from '../src/sensory/narration.json' with { type: 'json' };
import { appQuote } from '../src/copy.ts';
import { SENSORY, sensoryScenes, sensoryMusicVolume, captions, guideState } from '../src/sensory/story.ts';
import durations from '../src/sensory/voice-durations.json' with { type: 'json' };

test('new promo fits the user budget and every story frame belongs to exactly one scene', () => {
  expect(SENSORY.seconds).toBeGreaterThanOrEqual(50);
  expect(SENSORY.seconds).toBeLessThanOrEqual(60);
  expect([SENSORY.width, SENSORY.height, SENSORY.fps]).toEqual([1920, 1080, 60]);
  let end = 0;
  for (const scene of sensoryScenes) {
    expect(scene.from).toBe(end);
    expect(scene.duration).toBeGreaterThan(0);
    end += scene.duration;
  }
  expect(end).toBe(SENSORY.frames);
});

test('payment reads amount and receives yes before any target guidance', () => {
  const byId = (id: string) => narration.segments.find((s) => s.id === id)!;
  expect(byId('amount').text).toContain(appQuote.sayYesToPay);
  expect(byId('amount').text).toContain('twelve forty');
  expect(byId('amount').at + byId('amount').maxDuration).toBeLessThanOrEqual(byId('yes').at);
  expect(byId('yes').at + byId('yes').maxDuration).toBeLessThan(20);
  expect(guideState(19.99).stage).toBe('inactive');
  expect(guideState(20).stage).toBe('right');
});

test('music drops by at least 70% for the audible product demo and snaps off at PIN entry', () => {
  const beforeDuck = sensoryMusicVolume(13.5 * 60);
  for (let frame = 14 * 60; frame <= 28 * 60; frame++) expect(sensoryMusicVolume(frame)).toBeLessThanOrEqual(beforeDuck * 0.3 + 1e-8);
  expect(sensoryMusicVolume(29 * 60)).toBe(0);
  expect(sensoryMusicVolume(SENSORY.frames - 1)).toBe(0);
});

test('every spoken line has exact captions, a measured slot, and no overlapping speaker', () => {
  expect(captions.map((c) => c.text)).toEqual(narration.segments.map((s) => s.text));
  for (let i = 0; i < captions.length; i++) {
    const c = captions[i]!;
    expect(c.end).toBeGreaterThan(c.from);
    expect(c.end).toBeLessThanOrEqual(SENSORY.frames);
    if (i > 0) expect(c.from).toBeGreaterThanOrEqual(captions[i - 1]!.end);
  }
});

test('actual generated voice durations fit all speech slots without truncation', () => {
  const measured: Record<string, number> = durations;
  expect(Object.keys(measured).sort()).toEqual(narration.segments.map((s) => s.id).sort());
  for (const s of narration.segments) {
    expect(measured[s.id], s.id).toBeGreaterThan(0.1);
    expect(measured[s.id], s.id).toBeLessThan(s.maxDuration);
  }
});

test('guidance pitch increases with approach and stops on target and during PIN', () => {
  const a = guideState(20.2), b = guideState(22.5), c = guideState(24.5);
  expect(a.frequency).toBeGreaterThanOrEqual(220);
  expect(b.frequency).toBeGreaterThan(a.frequency);
  expect(c.frequency).toBeGreaterThan(b.frequency);
  expect(c.frequency).toBeLessThanOrEqual(1760);
  expect(guideState(24.8).stage).toBe('on');
  expect(guideState(24.8).frequency).toBe(0);
  expect(guideState(29).frequency).toBe(0);
});

test('app commands remain exact and glasses remain a future concept', () => {
  const byId = (id: string) => narration.segments.find((s) => s.id === id)!.text;
  expect(byId('press')).toBe(appQuote.pressNow);
  expect(byId('done')).toBe(appQuote.done);
  expect(byId('pin')).toBe(appQuote.pinPad);
  expect(byId('glasses')).toMatch(/^Next:/);
  const scenes = readFileSync(new URL('../src/sensory/scenes.tsx', import.meta.url), 'utf8');
  expect(scenes).toContain('Recorded phone demo');
  expect(scenes).toContain('Illustrated payment flow');
  expect(scenes).toContain('NEXT · CONCEPT');
});
