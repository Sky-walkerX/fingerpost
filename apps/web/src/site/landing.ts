import { animate, hover, inView, press, stagger } from 'motion';

// Every section renders complete without this script; motion only adds to a visible resting state.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
const springy = { type: 'spring', bounce: 0.25, duration: 0.7 } as const;

/** Runs `loop` only while `el` is on screen; the loop checks `alive()` and stops when it turns false. */
function whileVisible(el: Element, loop: (alive: () => boolean) => Promise<void> | void) {
  inView(el, () => {
    let on = true;
    void loop(() => on);
    return () => { on = false; };
  }, { amount: 0.25 });
}

function header() {
  const bar = $('#site-header');
  if (!bar) return;
  const update = () => bar.classList.toggle('scrolled', window.scrollY > 8);
  addEventListener('scroll', update, { passive: true });
  update();
}

/* ---------- Opening: transcript, tone line and "Play it out loud" ---------- */

const LEVELS = [0.12, 0.4, 0.72, 1];

function hear() {
  const lines = $$<HTMLLIElement>('#hear-lines li');
  const found = $<HTMLCanvasElement>('#tone');
  const button = $<HTMLButtonElement>('#play');
  if (!lines.length || !found || !button) return;
  const canvas: HTMLCanvasElement = found;
  const ctx = canvas.getContext('2d');
  let level = 1, grow = still ? 1 : 0, t = 0;

  const size = () => { const r = canvas.getBoundingClientRect(); canvas.width = Math.round(r.width * devicePixelRatio); canvas.height = Math.round(r.height * devicePixelRatio); };
  function draw() {
    if (!ctx) return;
    const w = canvas.width, h = canvas.height, mid = h / 2;
    ctx.clearRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#b9c6de'); gradient.addColorStop(0.55, '#7f9be6'); gradient.addColorStop(1, '#2f5fd6');
    ctx.lineWidth = 3 * devicePixelRatio; ctx.lineCap = 'round'; ctx.strokeStyle = gradient;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const u = x / w;
      const freq = 4 + (6 + level * 30) * u * u;
      const amp = (0.12 + 0.62 * u * (0.35 + level * 0.65)) * mid * grow;
      const y = mid + Math.sin(u * freq * Math.PI * 2 - t * (0.0018 + level * 0.006)) * amp;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  new ResizeObserver(() => { size(); draw(); }).observe(canvas);
  size(); draw();

  const highlight = (i: number) => lines.forEach((li, k) => { li.className = k < i ? 'done' : k === i ? 'now' : ''; });
  const setLevel = (to: number) => { if (still) { level = to; draw(); return; } animate(level, to, { duration: 0.9, ease: 'easeOut', onUpdate: (v) => { level = v; } }); };

  // Sound: a beep train whose pitch and rate rise with closeness, like the app's guidance tone.
  let audio: AudioContext | undefined;
  function beeps(closeness: number, count: number) {
    if (!audio) return;
    const start = audio.currentTime + 0.05, gap = 0.42 - closeness * 0.26, freq = 330 + closeness * 560;
    for (let i = 0; i < count; i++) {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'sine'; osc.frequency.value = freq + i * closeness * 18;
      const at = start + i * gap;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.18, at + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      osc.connect(gain).connect(audio.destination); osc.start(at); osc.stop(at + 0.18);
    }
    return count * gap * 1000;
  }
  function speak(text: string) {
    return new Promise<void>((done) => {
      if (!('speechSynthesis' in window)) { setTimeout(done, 900); return; }
      const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 1.02;
      const timer = setTimeout(done, 4000);
      u.onend = () => { clearTimeout(timer); done(); };
      u.onerror = () => { clearTimeout(timer); done(); };
      speechSynthesis.speak(u);
    });
  }

  let run = 0;
  async function sequence(withSound: boolean) {
    const id = ++run;
    for (let i = 0; i < lines.length; i++) {
      if (id !== run) return;
      highlight(i); setLevel(LEVELS[i]!);
      if (!still) animate(lines[i]!, { opacity: [0.35, 1], x: [-22, 0], filter: ['blur(6px)', 'blur(0px)'] }, { type: 'spring', bounce: 0.2, duration: 0.8 });
      if (withSound) {
        await speak(lines[i]!.textContent!.trim());
        if (id !== run) return;
        if (i === lines.length - 1) { try { navigator.vibrate?.(140); } catch { /* not allowed here */ } }
        await wait(beeps(LEVELS[i]!, i === lines.length - 1 ? 2 : 4) ?? 600);
      } else {
        await wait(i === lines.length - 1 ? 2600 : 1500);
      }
    }
    if (id !== run) return;
    if (withSound) { stopPlaying(); return; }
    highlight(lines.length);
    if (!still) await animate(lines, { opacity: [1, 0.3] }, { delay: stagger(0.07), duration: 0.5 }).finished;
    if (id !== run) return;
    lines.forEach((li) => { li.style.opacity = ''; });
    void sequence(false);
  }

  function stopPlaying() {
    button!.setAttribute('aria-pressed', 'false');
    $('#play-label')!.textContent = 'Play it out loud';
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    void audio?.close(); audio = undefined;
    if (!still) void sequence(false); else { run++; highlight(lines.length - 1); setLevel(1); }
  }
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') { run++; stopPlaying(); return; }
    button.setAttribute('aria-pressed', 'true');
    $('#play-label')!.textContent = 'Stop';
    try { audio = new AudioContext(); } catch { audio = undefined; }
    void sequence(true);
  });

  if (still) return;
  animate(lines, { opacity: [0, 1], y: [40, 0], filter: ['blur(10px)', 'blur(0px)'] }, { delay: stagger(0.12, { startDelay: 0.1 }), type: 'spring', bounce: 0.2, duration: 1 });
  animate($$('.play-box, .listen, .legend'), { opacity: [0, 1], y: [16, 0] }, { delay: stagger(0.1, { startDelay: 0.5 }), duration: 0.6 });
  animate(0, 1, { delay: 0.4, duration: 1.6, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => { grow = v; } });
  animate('.live-dot', { boxShadow: ['0 0 0 0 rgba(47,95,214,.5)', '0 0 0 12px rgba(47,95,214,0)'] }, { duration: 1.4, repeat: Infinity });
  animate('.play-ring', { boxShadow: ['0 0 0 0 rgba(255,185,143,.6)', '0 0 0 16px rgba(255,185,143,0)'] }, { duration: 1.8, repeat: Infinity, ease: 'easeOut' });
  whileVisible(canvas, async (alive) => {
    const frame = (now: number) => { if (!alive()) return; t = now; draw(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  });
  setTimeout(() => { if (run === 0) void sequence(false); }, 900);
}

/* ---------- Guided demo: a finger led to "Medium" ---------- */

function guided() {
  const vf = $('#viewfinder'), finger = $('#finger'), target = $('#target'), ring = $('#ring'), caption = $('#caption');
  const bars = $$('#meter i');
  if (!vf || !finger || !target || !ring || !caption) return;
  const pitch = (n: number) => bars.forEach((b, i) => { b.style.height = i < n ? `${30 + i * 17}%` : '22%'; b.style.opacity = i < n ? '1' : '.35'; });
  pitch(5);
  if (still) return;

  animate('.phone', { opacity: [0, 1], y: [60, 0], rotate: [5, 0] }, { type: 'spring', bounce: 0.25, duration: 1.2 });
  finger.style.left = '0'; finger.style.top = '0';
  const point = () => {
    const a = vf.getBoundingClientRect(), b = target.getBoundingClientRect();
    return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2, w: a.width, h: a.height };
  };
  const p0 = point();
  finger.style.transform = `translate(${p0.x}px, ${p0.y}px)`;
  const say = (text: string, level: number) => {
    caption.textContent = text; pitch(level);
    animate(caption.parentElement!, { scale: [0.94, 1] }, { type: 'spring', bounce: 0.45, duration: 0.45 });
  };
  const move = (x: number, y: number, duration = 0.9) => animate(finger, { transform: `translate(${x}px, ${y}px)` }, { type: 'spring', bounce: 0.15, duration }).finished;

  whileVisible(vf, async (alive) => {
    while (alive()) {
      const p = point();
      target.classList.remove('chosen');
      animate('.corner', { opacity: [0.2, 1], scale: [1.25, 1] }, { delay: stagger(0.07), type: 'spring', bounce: 0.4, duration: 0.6 });
      say('Screen found. Hold still.', 1);
      await move(p.w * 0.2, p.h * 0.78, 0.01); await wait(1300); if (!alive()) break;
      say('Medium. Move right.', 2); await move(p.x + 8, p.h * 0.78); await wait(450); if (!alive()) break;
      say('Up.', 3); await move(p.x + 4, p.y + 64); await wait(350); if (!alive()) break;
      say('Up a little.', 4); await move(p.x, p.y + 14, 0.7);
      animate(ring, { opacity: [0.9, 0], scale: [1, 1.5] }, { duration: 0.6, repeat: 2 });
      say('Press now.', 5); await move(p.x, p.y, 0.5); await wait(450); if (!alive()) break;
      animate(finger, { scale: [1, 0.68, 1] }, { duration: 0.35 });
      animate(target, { scale: [1, 0.93, 1] }, { duration: 0.35 });
      target.classList.add('chosen');
      say('Medium selected.', 5); await wait(2400);
    }
  });
}

/* ---------- Steps: a line that fills as you scroll ---------- */

function steps() {
  const list = $('#steps'), line = $('#steps-line');
  const nums = $$('#steps .step-num');
  if (!list || !line) return;
  if (still) { nums.forEach((n) => n.classList.add('lit')); return; }
  line.style.transform = 'scaleX(0)';
  const update = () => {
    const r = list.getBoundingClientRect(), vh = innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.8 - r.top) / (vh * 0.55)));
    line.style.transform = `scaleX(${p})`;
    nums.forEach((n, i) => {
      const lit = p >= i / Math.max(1, nums.length - 1) - 0.001;
      if (lit !== n.classList.contains('lit')) {
        n.classList.toggle('lit', lit);
        if (lit) animate(n, { scale: [0.7, 1.12, 1] }, { duration: 0.5 });
      }
    });
  };
  addEventListener('scroll', update, { passive: true });
  update();
  inView(list, () => { animate($$('#steps li'), { opacity: [0, 1], y: [28, 0] }, { delay: stagger(0.12), ...springy }); }, { amount: 0.3 });
}

/* ---------- Voice, tone, vibration glyphs ---------- */

function channels() {
  if (still) return;
  const rise = $<SVGPathElement>('#rise');
  whileVisible($('.channels')!, async (alive) => {
    const voice = animate('.voice span', { scaleY: [0.35, 1.25, 0.6, 1] }, { duration: 1.4, delay: stagger(0.09), repeat: Infinity, ease: 'easeInOut' });
    const buzz = animate('#buzz', { x: [0, -3, 3, -3, 3, 0] }, { duration: 0.45, repeat: Infinity, repeatDelay: 1.3 });
    const waves = animate('#buzz .wave-l, #buzz .wave-r', { opacity: [0.2, 1, 0.2] }, { duration: 0.45, repeat: Infinity, repeatDelay: 1.3 });
    let draw: ReturnType<typeof animate> | undefined;
    if (rise) {
      const len = rise.getTotalLength(); rise.style.strokeDasharray = `${len}`;
      draw = animate(rise, { strokeDashoffset: [len, 0] }, { duration: 1.6, repeat: Infinity, repeatDelay: 0.7, ease: 'easeOut' });
    }
    while (alive()) await wait(300);
    voice.stop(); buzz.stop(); waves.stop(); draw?.stop();
    if (rise) rise.style.strokeDashoffset = '0';
  });
}

/* ---------- Languages: the same instruction in three languages ---------- */

function languages() {
  const phrases = $$('#phrases li');
  if (!phrases.length) return;
  phrases[0]!.classList.add('on');
  if (still) { phrases.forEach((p) => p.classList.add('on')); return; }
  whileVisible($('#phrases')!, async (alive) => {
    let i = 0;
    while (alive()) {
      phrases.forEach((p, k) => p.classList.toggle('on', k === i));
      animate(phrases[i]!, { x: [-18, 0], filter: ['blur(5px)', 'blur(0px)'] }, { type: 'spring', bounce: 0.25, duration: 0.7 });
      await wait(2000);
      i = (i + 1) % phrases.length;
    }
  });
}

/* ---------- PIN pad: keys pressed, nothing sent ---------- */

function pinpad() {
  const keys = $$('#pinpad span:not(.blank)');
  if (!keys.length || still) return;
  inView('#pinpad', () => { animate(keys, { opacity: [0, 1], scale: [0.6, 1] }, { delay: stagger(0.04, { from: 'center' }), type: 'spring', bounce: 0.45, duration: 0.6 }); }, { amount: 0.4 });
  whileVisible($('#pinpad')!, async (alive) => {
    await wait(900);
    while (alive()) {
      const key = keys[Math.floor(Math.random() * keys.length)]!;
      animate(key, { backgroundColor: ['#24365e', '#3d5a9e', '#24365e'], scale: [1, 0.9, 1] }, { duration: 0.42 });
      animate('.off-dot', { scale: [1, 1.8, 1], opacity: [1, 0.5, 1] }, { duration: 0.42 });
      await wait(650);
    }
  });
}

/* ---------- Places: a slow strip that pauses on hover ---------- */

function marquee() {
  const box = $('#marquee'), row = $('#marquee .marquee-row');
  if (!box || !row || still) return;
  const track = document.createElement('div');
  track.className = 'marquee-track';
  row.replaceWith(track);
  const copy = row.cloneNode(true) as HTMLElement;
  copy.setAttribute('aria-hidden', 'true');
  track.append(row, copy);
  box.classList.add('moving');
  const distance = () => row.getBoundingClientRect().width + 14;
  let loop = animate(track, { x: [0, -distance()] }, { duration: distance() / 40, ease: 'linear', repeat: Infinity });
  new ResizeObserver(() => { loop.stop(); loop = animate(track, { x: [0, -distance()] }, { duration: distance() / 40, ease: 'linear', repeat: Infinity }); }).observe(row);
  box.addEventListener('pointerenter', () => loop.pause());
  box.addEventListener('pointerleave', () => loop.play());
}

/* ---------- Pipeline: frames and voice flowing into guidance ---------- */

function pipeline() {
  const svg = $<SVGSVGElement>('#pipeline');
  if (!svg || still) return;
  const pipes = $$<SVGPathElement>('.pipe', svg);
  pipes.forEach((p) => { const len = p.getTotalLength(); p.style.strokeDasharray = `${len}`; p.style.strokeDashoffset = `${len}`; });
  const routes: [SVGPathElement, SVGPathElement, SVGCircleElement][] = [
    [$('#pipe-a1', svg)!, $('#pipe-a2', svg)!, $('#pulse-a', svg)!],
    [$('#pipe-b1', svg)!, $('#pipe-b2', svg)!, $('#pulse-b', svg)!],
  ];
  inView(svg, () => {
    animate($$('.node', svg), { opacity: [0, 1], scale: [0.9, 1] }, { delay: stagger(0.1), type: 'spring', bounce: 0.35, duration: 0.7 });
    pipes.forEach((p, i) => animate(p, { strokeDashoffset: 0 }, { delay: 0.4 + i * 0.15, duration: 0.8, ease: 'easeInOut' }));
  }, { amount: 0.4 });
  const travel = (a: SVGPathElement, b: SVGPathElement, dot: SVGCircleElement) => {
    const la = a.getTotalLength(), lb = b.getTotalLength();
    return animate(0, la + lb, { duration: 1.5, ease: 'easeInOut', onUpdate: (d) => {
      const pt = d <= la ? a.getPointAtLength(d) : b.getPointAtLength(d - la);
      dot.setAttribute('cx', `${pt.x}`); dot.setAttribute('cy', `${pt.y}`);
      dot.style.opacity = `${Math.min(1, d / 20, (la + lb - d) / 20)}`;
    } }).finished;
  };
  whileVisible(svg, async (alive) => {
    await wait(1600);
    let k = 0;
    while (alive()) {
      const [a, b, dot] = routes[k % 2]!;
      await travel(a, b, dot);
      animate('.node.out rect', { scale: [1, 1.05, 1] }, { duration: 0.4 });
      k++;
      await wait(250);
    }
  });
}

/* ---------- Small responses to the visitor ---------- */

function micro() {
  if (still) return;
  hover('.btn, .pill, .play, .qr', (el) => {
    animate(el, { scale: 1.03 }, { type: 'spring', stiffness: 400, damping: 22 });
    return () => animate(el, { scale: 1 }, { type: 'spring', stiffness: 400, damping: 22 });
  });
  press('.btn, .pill, .play', (el) => {
    animate(el, { scale: 0.96 }, { type: 'spring', stiffness: 600, damping: 30 });
    return () => animate(el, { scale: 1 }, { type: 'spring', stiffness: 500, damping: 20 });
  });
  for (const d of $$<HTMLDetailsElement>('.faq details')) {
    d.addEventListener('toggle', () => { if (d.open) animate(d.querySelector('p')!, { opacity: [0, 1], y: [-8, 0] }, { duration: 0.35, ease: 'easeOut' }); });
  }
  inView('.waitlist-box', (el) => { animate(el, { opacity: [0, 1], y: [30, 0], scale: [0.98, 1] }, springy); }, { amount: 0.3 });
  inView('.qr', (el) => { animate(el, { rotate: [-6, 0], scale: [0.85, 1] }, { type: 'spring', bounce: 0.5, duration: 0.8 }); }, { amount: 0.5 });
}

export function startLanding() {
  header(); hear(); guided(); steps(); channels(); languages(); pinpad(); marquee(); pipeline(); micro();
}
