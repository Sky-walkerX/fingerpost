import './kiosk.css';
import { MENU, newOrder, press, view, type KioskButton, type KioskState, type KioskView } from './order.ts';

const W = 1600, H = 1000;
// Timed kiosk events: the card reader and the bank answer on their own, as a real terminal would.
const AUTO: Partial<Record<KioskState['screen'], [string, number]>> = {
  card: ['card-read', 3500], processing: ['processed', 2600], approved: ['new', 30000],
};

const q = new URLSearchParams(location.search);
let state = newOrder({ overcharge: q.get('overcharge') === '1' });
let timer: number | undefined;

const app = document.getElementById('app')!;
const stage = document.createElement('div');
stage.id = 'stage';
app.append(stage);

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const btn = (b: KioskButton, extra = '') => `<button type="button" class="b ${b.kind}${b.selected ? ' on' : ''}${extra}" data-a="${b.id}"${b.disabled ? ' aria-disabled="true"' : ''}>`
  + `${b.emoji ? `<span class="em" aria-hidden="true">${b.emoji}</span>` : ''}<span class="lb">${esc(b.label)}</span>`
  + `${b.price ? `<span class="pr">${esc(b.price)}</span>` : ''}</button>`;
const pick = (v: KioskView, kind: KioskButton['kind'] | ((b: KioskButton) => boolean)) =>
  v.buttons.filter(typeof kind === 'function' ? kind : (b) => b.kind === kind);
const logo = `<div class="logo"><span class="mark" aria-hidden="true"></span>Juniper Grill</div>`;

function screenHtml(v: KioskView): string {
  switch (v.screen) {
    case 'welcome':
      return `<section class="welcome">
        <div class="plates" aria-hidden="true"><span>🍔</span><span>🍟</span><span>🥤</span></div>
        <h1>${esc(v.title)}</h1><p class="sub">${esc(v.subtitle!)}</p>
        ${v.buttons.map((b) => btn(b, ' xl')).join('')}
        <p class="foot">Touch the screen to begin</p></section>`;
    case 'menu':
      return `<section class="menu">
        <nav class="rail">${logo}${pick(v, 'tab').map((b) => btn(b)).join('')}</nav>
        <div class="body">
          <header class="top"><h1>${esc(v.title)}</h1>${v.notice ? `<p class="toast">✓ ${esc(v.notice)}</p>` : ''}</header>
          <div class="grid">${pick(v, 'item').map((b) => btn(b)).join('')}</div>
          <footer class="bar"><p class="sum">${esc(v.texts[0]!)}</p>${pick(v, (b) => b.kind === 'secondary' || b.kind === 'primary').map((b) => btn(b)).join('')}</footer>
        </div></section>`;
    case 'item': {
      const em = MENU.find((m) => m.id === state.itemId)?.emoji ?? '';
      return `<section class="item">${logo}
        <div class="hero"><span class="big" aria-hidden="true">${em}</span><h1>${esc(v.title)}</h1><p class="sub">${esc(v.subtitle!)}</p></div>
        <div class="choices">${pick(v, (b) => b.kind === 'size' || b.kind === 'primary').map((b) => btn(b)).join('')}</div>
        ${pick(v, 'secondary').map((b) => btn(b, ' slim')).join('')}</section>`;
    }
    case 'review':
      return `<section class="review">${logo}
        <div class="cols"><div class="lines"><h1>${esc(v.title)}</h1><ul>${v.texts.map((t) => {
          const at = t.lastIndexOf(' $');
          return `<li><span>${esc(t.slice(0, at))}</span><span>${esc(t.slice(at + 1))}</span></li>`;
        }).join('')}</ul></div>
        <aside class="pay"><p class="lbl">Total</p><p class="tot">${esc(v.total!)}</p>${[...v.buttons].reverse().map((b) => btn(b)).join('')}</aside></div></section>`;
    case 'payment':
      return `<section class="payment">${logo}<h1>${esc(v.title)}</h1><p class="due">Total ${esc(v.total!)}</p>
        <div class="opts">${v.buttons.filter((b) => b.id !== 'back').map((b) => btn(b, ' tile')).join('')}</div>
        ${v.buttons.filter((b) => b.id === 'back').map((b) => btn(b, ' slim')).join('')}</section>`;
    case 'card':
      return `<section class="card">
        <div class="reader" aria-hidden="true"><div class="slot"></div><div class="plastic"><i></i></div><div class="waves"><b></b><b></b><b></b></div></div>
        <div class="msg"><h1>${esc(v.title)}</h1><p class="lbl">${esc(v.texts[0]!)}</p><p class="tot">${esc(v.total!)}</p>${v.buttons.map((b) => btn(b)).join('')}</div></section>`;
    case 'pin':
      return `<section class="pin"><div class="terminal">
        <h1>${esc(v.title)}</h1><p class="sub">${esc(v.subtitle!)}</p>
        <p class="amt"><span>${esc(v.texts[0]!)}</span><span>${esc(v.total!)}</span></p>
        <div class="dots" aria-label="${v.pinDots} digits entered">${Array.from({ length: 6 }, (_, i) => `<i class="${i < v.pinDots! ? 'f' : ''}"></i>`).join('')}</div>
        <div class="keys">${v.buttons.filter((b) => b.kind !== 'danger').map((b) => btn(b)).join('')}</div>
        ${pick(v, 'danger').map((b) => btn(b)).join('')}</div></section>`;
    case 'processing':
      return `<section class="wait"><div class="spin" aria-hidden="true"></div><h1>${esc(v.title)}</h1><p class="sub">${esc(v.texts[0]!)}</p></section>`;
    case 'approved':
      return `<section class="done"><div class="tick" aria-hidden="true">✓</div><h1>${esc(v.title)}</h1>
        <p class="num">${esc(v.subtitle!)}</p><p class="sub">${esc(v.texts[0]!)}</p>${v.buttons.map((b) => btn(b, ' xl')).join('')}</section>`;
  }
}

function render() {
  const v = view(state);
  stage.className = `s-${v.screen}`;
  stage.innerHTML = screenHtml(v);
  clearTimeout(timer);
  const auto = AUTO[v.screen];
  if (auto) timer = window.setTimeout(() => dispatch(auto[0]), auto[1]);
}

function dispatch(action: string) {
  const next = press(state, action);
  if (next === state) return;
  state = next;
  render();
}

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
}

stage.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-a]');
  if (b && b.getAttribute('aria-disabled') !== 'true') dispatch(b.dataset.a!);
});
addEventListener('pointerdown', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
}, { once: true });
addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !document.fullscreenElement) { state = newOrder({ overcharge: state.overcharge }); render(); } });
addEventListener('resize', fit);
fit();
render();
