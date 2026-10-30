import type { ElementRole } from '../sim/model.ts';

export const ROLES: ElementRole[] = ['button', 'pay', 'confirm', 'submit', 'back', 'cancel', 'input', 'text', 'icon', 'key'];
export const SCREEN_TYPES = ['menu', 'form', 'confirm', 'payment_entry', 'pin_pad', 'appliance', 'info', 'unknown'] as const;
export interface LabelImage { name: string; w: number; h: number; }
export interface LabelElement { label: string; role: ElementRole; box: { u: number; v: number; w: number; h: number }; }

export function labelItem(image: LabelImage, screenType: string, elements: LabelElement[], goalLines: string) {
  if (!image.name || /[\\/:%?#\u0000-\u001f]/u.test(image.name) || image.name === '.' || image.name === '..')
    throw new Error('Rename the photo to a simple filename before labeling.');
  if (![image.w, image.h].every((n) => Number.isInteger(n) && n > 0)) throw new Error('Load a valid JPEG first.');
  if (!SCREEN_TYPES.some((type) => type === screenType)) throw new Error('Choose a screen type.');
  if (!elements.length) throw new Error('Draw and label at least one control.');
  for (const element of elements) {
    const { u, v, w, h } = element.box;
    if (!element.label.trim() || !ROLES.includes(element.role)) throw new Error('Enter a label and role for every box.');
    if (![u, v, w, h].every(Number.isFinite) || u < 0 || v < 0 || w <= 0 || h <= 0 || u + w > 1 + 1e-9 || v + h > 1 + 1e-9)
      throw new Error('Keep every box inside the photo with a positive width and height.');
  }
  const goals = goalLines.split('\n').filter((line) => line.trim()).map((line) => {
    const parts = line.split('|').map((value) => value.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('Write each goal as goal | label.');
    const [goal, label] = parts;
    if (!elements.some((element) => element.label.trim() === label && element.role !== 'text'))
      throw new Error('Each goal must name an exactly labeled control.');
    return { goal, label };
  });
  const round = (x: number) => Math.round(x * 10_000) / 10_000;
  return { image: image.name, imageSize: { w: image.w, h: image.h }, screenType,
    elements: elements.map((e) => ({ ...e, label: e.label.trim(), box: { u: round(e.box.u), v: round(e.box.v),
      w: round(round(Math.min(1, e.box.u + e.box.w)) - round(e.box.u)),
      h: round(round(Math.min(1, e.box.v + e.box.h)) - round(e.box.v)) } })), goals,
  };
}
