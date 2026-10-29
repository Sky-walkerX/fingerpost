// Internal tool: draw element boxes on a photo and copy one evals LabelFile item (evals/src/dataset.ts).
import type { ElementRole } from '../sim/model.ts';

const ROLES: ElementRole[] = ['button', 'pay', 'confirm', 'submit', 'back', 'cancel', 'input', 'text', 'icon', 'key'];
const SCREEN_TYPES = ['menu', 'form', 'confirm', 'payment_entry', 'pin_pad', 'appliance', 'info', 'unknown'];

interface Box { u: number; v: number; w: number; h: number; }
interface Element { label: string; role: ElementRole; box: Box; }

const app = document.getElementById('app')!;
app.innerHTML = `
<style>
  body{margin:0;font:14px system-ui,sans-serif;background:#0b0f17;color:#e5e7eb}
  main{display:grid;grid-template-columns:1fr 340px;gap:16px;padding:16px}
  #stage{position:relative;align-self:start;user-select:none}
  #stage img{max-width:100%;display:block}
  .box{position:absolute;border:2px solid #22c55e;background:#22c55e22;pointer-events:none}
  .box span{position:absolute;top:-18px;left:0;background:#22c55e;color:#000;font-size:11px;padding:0 3px}
  aside{display:flex;flex-direction:column;gap:8px}
  input,select,button,textarea{font:inherit}
  textarea{height:180px}
  li{display:flex;gap:4px;align-items:center;margin-bottom:4px}
</style>
<div id="stage"><p>Choose a JPEG to start.</p></div>
<aside>
  <label>Photo <input id="file" type="file" accept="image/jpeg"></label>
  <label>Screen type <select id="screen">${SCREEN_TYPES.map((t) => `<option>${t}</option>`).join('')}</select></label>
  <p>Drag on the photo to add a box.</p>
  <ol id="elements"></ol>
  <label>Goals, one per line as <code>goal | label</code><textarea id="goals" rows="4"></textarea></label>
  <button id="copy">Copy JSON</button>
  <textarea id="out" readonly aria-label="Label JSON"></textarea>
</aside>`;

const stage = app.querySelector<HTMLDivElement>('#stage')!;
const list = app.querySelector<HTMLOListElement>('#elements')!;
const out = app.querySelector<HTMLTextAreaElement>('#out')!;
let image: { name: string; w: number; h: number } | null = null;
let img: HTMLImageElement | null = null;
const elements: Element[] = [];

app.querySelector<HTMLInputElement>('#file')!.addEventListener('change', (ev) => {
  const file = (ev.target as HTMLInputElement).files?.[0];
  if (!file) return;
  elements.length = 0;
  img = new Image();
  img.src = URL.createObjectURL(file);
  img.draggable = false;
  img.onload = () => { image = { name: file.name, w: img!.naturalWidth, h: img!.naturalHeight }; render(); };
  stage.replaceChildren(img);
});

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const toUnit = (ev: PointerEvent) => {
  const r = img!.getBoundingClientRect();
  return { u: clamp((ev.clientX - r.left) / r.width), v: clamp((ev.clientY - r.top) / r.height) };
};
let start: { u: number; v: number } | null = null;
stage.addEventListener('pointerdown', (ev) => { if (img) { start = toUnit(ev); stage.setPointerCapture(ev.pointerId); } });
stage.addEventListener('pointerup', (ev) => {
  if (!start || !img) return;
  const end = toUnit(ev);
  const box = { u: Math.min(start.u, end.u), v: Math.min(start.v, end.v), w: Math.abs(end.u - start.u), h: Math.abs(end.v - start.v) };
  start = null;
  if (box.w < 0.005 || box.h < 0.005) return;
  const label = prompt('Label, exactly as printed')?.trim();
  if (!label) return;
  elements.push({ label, role: 'button', box });
  render();
});

const round = (x: number) => Math.round(x * 10_000) / 10_000;
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
    const role = document.createElement('select');
    role.setAttribute('aria-label', `Role of ${e.label}`);
    role.innerHTML = ROLES.map((r) => `<option${r === e.role ? ' selected' : ''}>${r}</option>`).join('');
    role.onchange = () => { e.role = role.value as ElementRole; };
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.onclick = () => { elements.splice(i, 1); render(); };
    li.append(document.createTextNode(e.label), role, remove);
    list.append(li);
  });
}

app.querySelector<HTMLButtonElement>('#copy')!.addEventListener('click', async () => {
  if (!image) return;
  const goals = app.querySelector<HTMLTextAreaElement>('#goals')!.value.split('\n')
    .map((line) => line.split('|').map((s) => s.trim())).filter(([g, l]) => g && l).map(([goal, label]) => ({ goal: goal!, label: label! }));
  const item = {
    image: image.name, imageSize: { w: image.w, h: image.h },
    screenType: app.querySelector<HTMLSelectElement>('#screen')!.value,
    elements: elements.map((e) => ({ label: e.label, role: e.role, box: { u: round(e.box.u), v: round(e.box.v), w: round(e.box.w), h: round(e.box.h) } })),
    goals,
  };
  out.value = JSON.stringify(item, null, 2);
  await navigator.clipboard?.writeText(out.value).catch(() => {});
});
