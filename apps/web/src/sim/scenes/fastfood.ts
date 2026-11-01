import { mulberry32 } from '../rng.ts';
import { jitter } from '../layout.ts';
import type { SimElement, SimScene, SimScreen } from '../model.ts';
import { buildPinPad, type PinLayout } from './pinpad.ts';

const el = (id: string, label: string, role: SimElement['role'], x: number, y: number, w = 300, h = 120): SimElement => ({ id, label, role, rect: { x, y, w, h } });

export function buildFastFood(seed: number, layout: PinLayout = 'scrambled'): SimScene {
  const rnd = mulberry32(seed);
  const pinScene = buildPinPad(seed, layout);
  const pinScreen: SimScreen = {
    ...pinScene.screens[0]!,
    next: { 'key-ok': 'done', 'key-enter': 'done' },
  };
  const screens: SimScreen[] = [
    { id: 'home', title: 'Welcome', next: { 'start-order': 'menu' }, elements: [
      el('welcome', 'Welcome to Fingerburger', 'text', 340, 120, 600, 100), el('start-order', 'Start order', 'button', 440, 420, 400, 160) ] },
    { id: 'menu', title: 'Menu', next: { drinks: 'drink-size', cart: 'pay' }, elements: [
      el('burgers', 'Burgers', 'button', 120, 200), el('drinks', 'Drinks', 'button', 490, 200), el('sides', 'Sides', 'button', 860, 200),
      el('cart', 'View cart', 'button', 860, 560) ] },
    { id: 'drink-size', title: 'Choose a size', next: { small: 'pay', medium: 'pay', large: 'pay', back: 'menu' }, elements: [
      el('small', 'Small ₹99', 'button', 120, 240), el('medium', 'Medium ₹149', 'button', 490, 240), el('large', 'Large ₹179', 'button', 860, 240),
      el('back', 'Back', 'back', 120, 600, 220, 110) ] },
    { id: 'pay', title: 'Pay', next: { 'pay-card': 'pin', cancel: 'menu' }, elements: [
      el('total', 'Total ₹149', 'text', 340, 120, 600, 100), el('cancel', 'Cancel', 'cancel', 160, 520, 340, 140), el('pay-card', 'Pay by card', 'pay', 780, 520, 340, 140) ] },
    { id: 'done', title: 'Thank you', next: { 'start-over': 'home' }, elements: [
      el('thanks', 'Payment started. Thank you!', 'text', 290, 160, 700, 100), el('start-over', 'Start over', 'button', 490, 480) ] },
  ];
  const jittered = screens.map((s) => ({ ...s, elements: jitter(s.elements, rnd) }));
  const doneIdx = jittered.findIndex((s) => s.id === 'done');
  jittered.splice(doneIdx, 0, pinScreen);
  return { id: 'fastfood', seed, start: 'home', screens: jittered };
}
