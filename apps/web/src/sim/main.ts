import { applyTouch, currentScreen, exportRun, labelsFor, newRun } from './log.ts';
import { CANVAS, type SimScene } from './model.ts';
import { buildFastFood } from './scenes/fastfood.ts';
import { buildPinPad, type PinLayout } from './scenes/pinpad.ts';
import { buildTicket } from './scenes/ticket.ts';
import { buildCooktop } from './scenes/cooktop.ts';
import { buildCheckin } from './scenes/checkin.ts';
import { buildAdversarial } from './scenes/adversarial.ts';
import { postTouch } from './net.ts';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') ?? '1') || 1;
const runId = q.get('run') ?? `run-${Date.now().toString(36)}`;
const builders: Record<string, (seed: number) => SimScene> = {
  fastfood: (s) => buildFastFood(s, 'scrambled', q.get('overcharge') === '1'),
  ticket: buildTicket,
  cooktop: buildCooktop,
  pinpad: (s) => buildPinPad(s, (q.get('layout') as PinLayout | null) ?? 'phone'),
  checkin: buildCheckin,
  adversarial: buildAdversarial,
};
const scene: SimScene = (builders[q.get('scene') ?? 'fastfood'] ?? buildFastFood)(seed);
const gatewayUrl = q.get('gw'); // e.g. ?gw=http://192.168.1.20:8080 to relay touches to the linked app session
const simToken = q.get('token') ?? undefined;
const state = newRun(runId, scene);
// Eval dataset rendering (evals/scripts/render-sim.ts) reads ground truth through this hook.
if (q.get('export') === '1') Object.assign(window, { __fp: { labels: () => labelsFor(currentScreen(state)), screenId: () => state.screenId } });

const app = document.getElementById('app')!;
document.head.insertAdjacentHTML('beforeend', `<style>
  html,body{margin:0;height:100%;background:#0b0f17;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
  #stage{position:absolute;left:0;top:0;width:${CANVAS.w}px;height:${CANVAS.h}px;transform-origin:0 0;background:#111827;font-family:system-ui,sans-serif}
  .el{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:18px;font-size:40px;font-weight:700;color:#fff;background:#2563eb;box-sizing:border-box}
  .el.text{background:none;color:#e5e7eb;font-weight:600}.el.pay{background:#16a34a}.el.cancel,.el.back{background:#6b7280}.el.key{background:#334155;font-size:56px}.el.confirm{background:#16a34a}.el.submit{background:#2563eb}.el.input{background:#1e293b;border:2px solid #475569;color:#e2e8f0}.el.icon{background:#475569;font-size:32px}
  #stage.low-contrast{background:#1e2430}
  #stage.low-contrast .el{background:#283040;color:#3b465c;border:1px solid #2e374a}
  #stage.low-contrast .el.text{background:none;color:#343e52}
  #stage.low-contrast .el.confirm,#stage.low-contrast .el.submit{background:#233a30;color:#345242}
  #stage.low-contrast .el.cancel,#stage.low-contrast .el.back{background:#283040;color:#3b465c}
  #glare{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 40%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.15) 45%, transparent 70%);z-index:5}
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
  const scr = currentScreen(state);
  stage.className = scr.id.includes('contrast') ? 'low-contrast' : '';
  const els: HTMLElement[] = scr.elements.map((e) => {
    const d = document.createElement('div');
    d.className = `el ${e.role}`;
    d.textContent = e.label;
    Object.assign(d.style, { left: `${e.rect.x}px`, top: `${e.rect.y}px`, width: `${e.rect.w}px`, height: `${e.rect.h}px` });
    return d;
  });
  if (q.get('glare') === '1') {
    const glare = document.createElement('div');
    glare.id = 'glare';
    els.push(glare);
  }
  stage.replaceChildren(...els);
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
  const touch = applyTouch(state, { x: Math.round(p.x), y: Math.round(p.y), pointerId: ev.pointerId, ts: Date.now() });
  if (gatewayUrl) void postTouch(touch, { gatewayUrl, ...(simToken ? { token: simToken } : {}) });
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
