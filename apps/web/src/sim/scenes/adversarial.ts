import { mulberry32 } from '../rng.ts';
import { jitter } from '../layout.ts';
import type { SimElement, SimScene, SimScreen } from '../model.ts';

const el = (id: string, label: string, role: SimElement['role'], x: number, y: number, w = 320, h = 120): SimElement => ({ id, label, role, rect: { x, y, w, h } });

/** Adversarial kiosk: near-duplicate labels, icon-only button, low-contrast screen, and Hindi-language screen. */
export function buildAdversarial(seed: number): SimScene {
  const rnd = mulberry32(seed);
  const screens: SimScreen[] = [
    {
      id: 'home',
      title: 'Adversarial Kiosk',
      next: {
        start: 'low-contrast',
        'quick-start': 'low-contrast',
        'icon-help': 'hindi',
        'goto-contrast': 'low-contrast',
        'goto-hindi': 'hindi',
      },
      elements: [
        el('title', 'Welcome / स्वागत', 'text', 340, 50, 600, 90),
        el('start', 'Start', 'button', 140, 180, 280, 120),
        el('quick-start', 'Quick start', 'button', 500, 180, 280, 120),
        el('icon-help', '', 'icon', 860, 180, 160, 120),
        el('goto-contrast', 'Low contrast mode', 'button', 160, 420, 420, 120),
        el('goto-hindi', 'हिंदी भाषा', 'button', 660, 420, 420, 120),
      ],
    },
    {
      id: 'low-contrast',
      title: 'Low Contrast',
      next: {
        'lc-submit': 'hindi',
        'lc-confirm': 'hindi',
        'lc-back': 'home',
        'lc-hindi': 'hindi',
      },
      elements: [
        el('lc-title', 'Low Contrast Screen', 'text', 340, 80, 600, 90),
        el('lc-submit', 'Submit', 'submit', 320, 240, 300, 120),
        el('lc-confirm', 'Quick submit', 'confirm', 680, 240, 300, 120),
        el('lc-back', 'Back', 'back', 200, 480, 280, 120),
        el('lc-hindi', 'हिंदी', 'button', 560, 480, 280, 120),
      ],
    },
    {
      id: 'hindi',
      title: 'हिंदी स्क्रीन',
      next: {
        'hi-start': 'done',
        'hi-fast-start': 'done',
        'hi-back': 'home',
        'hi-done': 'done',
      },
      elements: [
        el('hi-title', 'कृपया एक विकल्प चुनें', 'text', 290, 80, 700, 90),
        el('hi-start', 'शुरू करें', 'button', 180, 240, 340, 120),
        el('hi-fast-start', 'त्वरित शुरुआत', 'button', 620, 240, 340, 120),
        el('hi-back', 'पीछे', 'back', 180, 480, 280, 120),
        el('hi-done', 'पूर्ण करें', 'confirm', 540, 480, 280, 120),
      ],
    },
    {
      id: 'done',
      title: 'पूर्ण / Done',
      next: {
        'start-over': 'home',
      },
      elements: [
        el('done-title', 'प्रक्रिया पूर्ण / Done', 'text', 340, 160, 600, 90),
        el('start-over', 'Start over', 'button', 490, 460, 300, 120),
      ],
    },
  ];

  return { id: 'adversarial', seed, start: 'home', screens: screens.map((s) => ({ ...s, elements: jitter(s.elements, rnd) })) };
}

