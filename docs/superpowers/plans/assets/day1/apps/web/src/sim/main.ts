import { applyTouch, currentScreen, exportRun, labelsFor, newRun } from './log.ts';
import { CANVAS, type SimScene } from './model.ts';
import { buildFastFood } from './scenes/fastfood.ts';
import { buildPinPad, type PinLayout } from './scenes/pinpad.ts';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') ?? '1') || 1;
const runId = q.get('run') ?? `run-${Date.now().toString(36)}`;
const builders: Record<string, (seed: number) => SimScene> = {
  fastfood: buildFastFood,
  pinpad: (s) => buildPinPad(s, (q.get('layout') as PinLayout | null) ?? 'phone'),
};
const scene: SimScene = (builders[q.get('scene') ?? 'fastfood'] ?? buildFastFood)(seed);

const state = newRun(runId, scene);

const app = document.getElementById('app')!;
document.head.insertAdjacentHTML('beforeend', `<style>
  html,body{margin:0;height:100%;background:#0b0f17;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
  #stage{position:absolute;left:0;top:0;width:${CANVAS.w}px;height:${CANVAS.h}px;transform-origin:0 0;background:#111827;font-family:system-ui,sans-serif}
  .el{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:18px;font-size:40px;font-weight:700;color:#fff;background:#2563eb;box-sizing:border-box}
  .el.text{background:none;color:#e5e7eb;font-weight:600}.el.pay{background:#16a34a}.el.cancel,.el.back{background:#6b7280}.el.key{background:#334155;font-size:56px}.el.confirm{background:#16a34a}
  #panel{position:fixed;inset:5%;background:#fff;color:#111;padding:16px;overflow:auto;font:14px ui-monospace,monospace;white-space:pre-wrap;z-index:10}
</style>`);
const stage = document.createElement('div');
stage.id = 'stage';
app.append(stage);

function fit() {
  const s = Math.min(innerWidth / CANVAS.w, innerHeight / CANVAS.h);
  stage.style.transform = `translate(${(innerWidth - CANVAS.w * s) / 2}px, ${(innerHeight - CANVAS.h * s) / 2}px) scale(${s})`;
}
function render() {
  stage.replaceChildren(...currentScreen(state).elements.map((e) => {
    const d = document.createElement('div');
    d.className = `el ${e.role}`;
    d.textContent = e.label;
    Object.assign(d.style, { left: `${e.rect.x}px`, top: `${e.rect.y}px`, width: `${e.rect.w}px`, height: `${e.rect.h}px` });
    return d;
  }));
}
function toCanvas(ev: PointerEvent) {
  const r = stage.getBoundingClientRect();
  return { x: ((ev.clientX - r.left) / r.width) * CANVAS.w, y: ((ev.clientY - r.top) / r.height) * CANVAS.h };
}

let fingers = 0, holdTimer: number | undefined;
addEventListener('pointerdown', (ev) => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  fingers++;
  if (fingers === 3) holdTimer = window.setTimeout(showPanel, 1500); // hidden 3-finger long-press
  const p = toCanvas(ev);
  applyTouch(state, { x: Math.round(p.x), y: Math.round(p.y), pointerId: ev.pointerId, ts: Date.now() });
  render();
});
addEventListener('pointerup', () => { fingers = Math.max(0, fingers - 1); clearTimeout(holdTimer); });
addEventListener('pointercancel', () => { fingers = 0; clearTimeout(holdTimer); });

function showPanel() {
  const panel = document.createElement('div');
  panel.id = 'panel';
  panel.textContent = `RUN\n${exportRun(state)}\n\nLABELS (${state.screenId})\n${JSON.stringify(labelsFor(currentScreen(state)), null, 2)}\n\nTap here to close.`;
  panel.addEventListener('pointerdown', (e) => { e.stopPropagation(); panel.remove(); });
  document.body.append(panel);
}

addEventListener('resize', fit);
fit();
render();
