import { mulberry32 } from '../rng.ts';
import { jitter } from '../layout.ts';
import type { SimElement, SimScene, SimScreen } from '../model.ts';

const el = (id: string, label: string, role: SimElement['role'], x: number, y: number, w = 300, h = 120): SimElement => ({ id, label, role, rect: { x, y, w, h } });

/** Airport check-in: language → booking reference → seat → boarding pass print-confirm. */
export function buildCheckin(seed: number): SimScene {
  const rnd = mulberry32(seed);
  const screens: SimScreen[] = [
    {
      id: 'lang',
      title: 'Language',
      next: { english: 'booking', hindi: 'booking' },
      elements: [
        el('title', 'Select language / भाषा चुनें', 'text', 290, 100, 700, 100),
        el('english', 'English', 'button', 210, 360, 340, 120),
        el('hindi', 'हिंदी', 'button', 730, 360, 340, 120),
      ],
    },
    {
      id: 'booking',
      title: 'Booking Reference',
      next: { continue: 'seat', back: 'lang' },
      elements: [
        el('title', 'Enter booking reference', 'text', 340, 80, 600, 90),
        el('ref-display', 'FP-9824', 'input', 440, 220, 400, 100),
        el('back', 'Back', 'back', 160, 520, 300, 120),
        el('continue', 'Continue', 'button', 820, 520, 300, 120),
      ],
    },
    {
      id: 'seat',
      title: 'Seat Selection',
      next: { 'seat-12a': 'confirm', 'seat-12b': 'confirm', 'seat-12c': 'confirm', back: 'booking' },
      elements: [
        el('title', 'Choose your seat', 'text', 340, 80, 600, 90),
        el('seat-12a', '12A Window', 'button', 140, 240, 280, 120),
        el('seat-12b', '12B Middle', 'button', 500, 240, 280, 120),
        el('seat-12c', '12C Aisle', 'button', 860, 240, 280, 120),
        el('back', 'Back', 'back', 140, 540, 240, 110),
      ],
    },
    {
      id: 'confirm',
      title: 'Boarding Pass',
      next: { print: 'lang', back: 'seat' },
      elements: [
        el('title', 'Boarding pass ready', 'text', 340, 100, 600, 90),
        el('details', 'Flight FP-101 • Gate 4B', 'text', 340, 220, 600, 90),
        el('print', 'Print boarding pass', 'confirm', 440, 420, 400, 140),
        el('back', 'Back', 'back', 140, 580, 240, 110),
      ],
    },
  ];
  return { id: 'checkin', seed, start: 'lang', screens: screens.map((s) => ({ ...s, elements: jitter(s.elements, rnd) })) };
}

