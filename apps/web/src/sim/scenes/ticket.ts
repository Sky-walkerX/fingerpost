import { mulberry32 } from '../rng.ts';
import { jitter } from '../layout.ts';
import type { SimElement, SimScene, SimScreen } from '../model.ts';

const el = (id: string, label: string, role: SimElement['role'], x: number, y: number, w = 340, h = 120): SimElement => ({ id, label, role, rect: { x, y, w, h } });

/** Metro ticket machine: language → destination → count → pay → done. Labels mix English and Hindi like real Indian TVMs. */
export function buildTicket(seed: number): SimScene {
  const rnd = mulberry32(seed);
  const screens: SimScreen[] = [
    { id: 'lang', title: 'Language', next: { english: 'dest', hindi: 'dest' }, elements: [
      el('title', 'Choose language / भाषा चुनें', 'text', 290, 100, 700, 100), el('english', 'English', 'button', 210, 360), el('hindi', 'हिंदी', 'button', 730, 360) ] },
    { id: 'dest', title: 'Destination', next: { 'rajiv-chowk': 'count', 'kashmere-gate': 'count', 'hauz-khas': 'count', dwarka: 'count', back: 'lang' }, elements: [
      el('title', 'Where to?', 'text', 440, 40, 400, 90),
      el('rajiv-chowk', 'Rajiv Chowk', 'button', 120, 200), el('kashmere-gate', 'Kashmere Gate', 'button', 820, 200),
      el('hauz-khas', 'Hauz Khas', 'button', 120, 400), el('dwarka', 'Dwarka', 'button', 820, 400),
      el('back', 'Back', 'back', 120, 620, 220, 110) ] },
    { id: 'count', title: 'Tickets', next: { one: 'pay', two: 'pay', three: 'pay', back: 'dest' }, elements: [
      el('one', '1 ticket', 'button', 90, 260, 300), el('two', '2 tickets', 'button', 490, 260, 300), el('three', '3 tickets', 'button', 890, 260, 300),
      el('back', 'Back', 'back', 120, 620, 220, 110) ] },
    { id: 'pay', title: 'Pay', next: { 'pay-card': 'done', 'pay-upi': 'done', cancel: 'dest' }, elements: [
      el('fare', 'Fare ₹40', 'text', 440, 80, 400, 100),
      el('pay-card', 'Pay by card', 'pay', 120, 330), el('pay-upi', 'Pay by UPI', 'pay', 820, 330),
      el('cancel', 'Cancel', 'cancel', 470, 600) ] },
    { id: 'done', title: 'Done', next: { 'start-over': 'lang' }, elements: [
      el('collect', 'Collect your token below', 'text', 290, 160, 700, 100), el('start-over', 'Start over', 'button', 470, 480) ] },
  ];
  return { id: 'ticket', seed, start: 'lang', screens: screens.map((s) => ({ ...s, elements: jitter(s.elements, rnd) })) };
}
