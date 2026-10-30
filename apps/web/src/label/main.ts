// Internal tool: draw element boxes on a photo and copy one evals LabelFile item (evals/src/dataset.ts).
import { labelItem, ROLES, SCREEN_TYPES, type LabelElement, type LabelImage } from './model.ts';
import type { ElementRole } from '../sim/model.ts';

const app = document.getElementById('app')!;
app.innerHTML = `
<style>
  body{margin:0;font:14px system-ui,sans-serif;background:#0b0f17;color:#e5e7eb}
  main{display:grid;grid-template-columns:1fr 340px;gap:16px;padding:16px}
  #stage{position:relative;align-self:start;user-select:none}
  #stage img{width:100%;height:auto;display:block;touch-action:none}
  .box{position:absolute;border:2px solid #22c55e;background:#22c55e22;pointer-events:none;box-sizing:border-box}
  .box span{position:absolute;top:-18px;left:0;background:#22c55e;color:#000;font-size:11px;padding:0 3px}
  aside{display:flex;flex-direction:column;gap:8px}
  input,select,button,textarea{font:inherit}
  textarea{height:180px}
  li{display:flex;gap:4px;align-items:center;margin-bottom:4px}
  li input{min-width:0;width:100%}
  @media(max-width:760px){main{grid-template-columns:1fr}}
</style>
<div id="stage"><p>Choose a JPEG to start.</p></div>
<aside>
  <label>Photo <input id="file" type="file" accept="image/jpeg"></label>
  <label>Screen type <select id="screen">${SCREEN_TYPES.map((t) => `<option>${t}</option>`).join('')}</select></label>
  <p>Drag on the photo to add a box.</p>
  <ol id="elements"></ol>
  <label>Goals, one per line as <code>goal | label</code><textarea id="goals" rows="4"></textarea></label>
  <button id="copy" disabled>Copy JSON</button>
  <p id="status" role="status">Photos and labels stay in this browser. Nothing is uploaded.</p>
  <textarea id="out" readonly aria-label="Label JSON"></textarea>
</aside>`;

const stage = app.querySelector<HTMLDivElement>('#stage')!;
const list = app.querySelector<HTMLOListElement>('#elements')!;
const out = app.querySelector<HTMLTextAreaElement>('#out')!;
let image: LabelImage | null = null;
let img: HTMLImageElement | null = null;
const elements: LabelElement[] = [];
const copy = app.querySelector<HTMLButtonElement>('#copy')!;
const status = app.querySelector<HTMLParagraphElement>('#status')!;
let objectUrl: string | undefined;

app.querySelector<HTMLInputElement>('#file')!.addEventListener('change', (ev) => {
  const file = (ev.target as HTMLInputElement).files?.[0];
  image = null; start = null; img = null; out.value = ''; copy.disabled = true;
  elements.length = 0;
  list.replaceChildren(); stage.replaceChildren(); app.querySelector<HTMLTextAreaElement>('#goals')!.value = '';
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  if (!file) return;
  if (file.type !== 'image/jpeg') { status.textContent = 'Choose a JPEG photo.'; return; }
  const selected = new Image();
  img = selected;
  objectUrl = URL.createObjectURL(file);
  selected.draggable = false;
  selected.onload = () => {
    if (img !== selected) return;
    image = { name: file.name, w: selected.naturalWidth, h: selected.naturalHeight };
    copy.disabled = false; status.textContent = 'Draw boxes, enter labels and add goals before copying.'; render();
  };
  selected.onerror = () => { if (img === selected) { image = null; copy.disabled = true; status.textContent = 'The photo could not be read. Choose another JPEG.'; } };
  selected.src = objectUrl;
  stage.replaceChildren(selected);
});

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const toUnit = (ev: PointerEvent) => {
  const r = img!.getBoundingClientRect();
  return { u: clamp((ev.clientX - r.left) / r.width), v: clamp((ev.clientY - r.top) / r.height) };
};
let start: { u: number; v: number } | null = null;
stage.addEventListener('pointerdown', (ev) => { if (image && img) { start = toUnit(ev); stage.setPointerCapture(ev.pointerId); } });
stage.addEventListener('pointercancel', () => { start = null; });
stage.addEventListener('pointerup', (ev) => {
  if (!start || !img) return;
  const end = toUnit(ev);
  const box = { u: Math.min(start.u, end.u), v: Math.min(start.v, end.v), w: Math.abs(end.u - start.u), h: Math.abs(end.v - start.v) };
  start = null;
  if (box.w < 0.005 || box.h < 0.005) return;
  elements.push({ label: '', role: 'button', box });
  render();
  list.lastElementChild?.querySelector<HTMLInputElement>('input')?.focus();
});

function render() {
  if (!img) return;
  stage.querySelectorAll('.box').forEach((b) => b.remove());
  list.replaceChildren();
  elements.forEach((e, i) => {
    const d = document.createElement('div');
    d.className = 'box';
    Object.assign(d.style, { left: `${e.box.u * 100}%`, top: `${e.box.v * 100}%`, width: `${e.box.w * 100}%`, height: `${e.box.h * 100}%` });
    d.innerHTML = '<span></span>';
    d.querySelector('span')!.textContent = e.label;
    stage.append(d);
    const li = document.createElement('li');
    const label = document.createElement('input');
    label.value = e.label; label.placeholder = 'Label exactly as printed'; label.setAttribute('aria-label', `Label for box ${i + 1}`);
    label.oninput = () => { e.label = label.value; d.querySelector('span')!.textContent = e.label; };
    const role = document.createElement('select');
    role.setAttribute('aria-label', `Role for box ${i + 1}`);
    role.innerHTML = ROLES.map((r) => `<option${r === e.role ? ' selected' : ''}>${r}</option>`).join('');
    role.onchange = () => { e.role = role.value as ElementRole; };
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.onclick = () => { elements.splice(i, 1); render(); };
    li.append(label, role, remove);
    list.append(li);
  });
}

copy.addEventListener('click', async () => {
  out.value = '';
  if (!image) return;
  let item;
  try { item = labelItem(image, app.querySelector<HTMLSelectElement>('#screen')!.value, elements, app.querySelector<HTMLTextAreaElement>('#goals')!.value); }
  catch (error) { status.textContent = error instanceof Error ? error.message : 'Check the labels and goals.'; return; }
  out.value = JSON.stringify(item, null, 2);
  try {
    if (!navigator.clipboard) throw new Error('unavailable');
    await navigator.clipboard.writeText(out.value); status.textContent = 'Copied. Add this item to the items array in your private labels.json.';
  } catch { status.textContent = 'JSON is ready below. Select and copy it manually.'; }
});
