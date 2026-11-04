import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { color, font } from '../tokens.ts';
import { Chapter, GlassesDrawing, Grid, Icon, MiniWave, pop, ramp, RevealText, Ring, smooth } from './graphics.tsx';
import { guideState, type SensorySceneId } from './story.ts';

const Pill: React.FC<{ children: React.ReactNode; peach?: boolean; dark?: boolean }> = ({ children, peach = false, dark = true }) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderRadius: 100, fontFamily: font.body, fontWeight: 650, fontSize: 27, letterSpacing: '0.015em', color: peach ? color.peach : dark ? color.periwinkle : color.blue, background: peach ? 'rgba(255,185,143,0.1)' : dark ? color.raised : '#e3ebff' }}>{children}</span>;

const Tension: React.FC = () => {
  const f = useCurrentFrame();
  const cuts = [0, 60, 132, 168];
  const i = Math.max(0, cuts.findLastIndex((c) => f >= c));
  const local = f - cuts[i]!;
  const text = ['FLAT', 'GLASS.', 'NOTHING', 'TO FEEL.'][i]!;
  return <AbsoluteFill style={{ background: '#02050c', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: -80, opacity: 0.43, filter: 'grayscale(1) contrast(1.55)', transform: `scale(${1.25 + local * 0.0009}) translateX(${i % 2 ? -70 : 30}px)` }}>
      <Sequence from={0} durationInFrames={132}><OffthreadVideo muted src={staticFile('demo/live-demo.mp4')} trimBefore={Math.round(11.8 * 60)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '80% 70%' }} /></Sequence>
      <Sequence from={132}><OffthreadVideo muted src={staticFile('demo/live-demo.mp4')} trimBefore={Math.round(39.5 * 60)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '70% 65%' }} /></Sequence>
    </div>
    <AbsoluteFill style={{ background: 'linear-gradient(90deg,rgba(2,5,12,0.12),rgba(2,5,12,0.65))' }} />
    <Chapter number="00" text="A WORLD BEHIND GLASS" />
    <div style={{ position: 'absolute', left: 90, top: 300, right: 70, transform: `translateX(${(1 - smooth(local, 0, 7)) * 90}px) scale(${1.035 - ramp(local, 0, 45) * 0.035})`, opacity: ramp(local, 0, 4) }}>
      <div style={{ fontFamily: font.body, fontWeight: 850, fontSize: i < 2 ? 272 : 225, letterSpacing: '-0.075em', lineHeight: 0.95, color: i === 3 ? color.peach : '#fff' }}>{text}</div>
      <div style={{ width: 160 + ramp(local, 0, 35) * 550, height: 9, background: i === 3 ? color.peach : color.periwinkle, marginTop: 36 }} />
    </div>
    <div style={{ position: 'absolute', right: 90, bottom: 200, color: color.nightText, fontFamily: font.body, fontSize: 28 }}>For a blind person, where is the button?</div>
    <div style={{ position: 'absolute', inset: 0, border: '24px solid #02050c', pointerEvents: 'none' }} />
  </AbsoluteFill>;
};

const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const expand = smooth(f, 0, 30);
  return <AbsoluteFill style={{ background: color.night, overflow: 'hidden' }}>
    <AbsoluteFill style={{ background: color.day, clipPath: `circle(${expand * 2200}px at 50% 52%)` }} />
    <Grid light />
    <Chapter number="01" text="GIVE THE GLASS A VOICE" light />
    <div style={{ position: 'absolute', left: 100, right: 100, top: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 50 }}>
      <div style={{ transform: `scale(${pop(f, 12)}) rotate(${-35 * (1 - smooth(f, 8, 50))}deg)` }}><Ring size={240} progress={smooth(f, 12, 55)} /></div>
      <RevealText at={20} size={230} serif ink={color.ink}>Fingerpost.</RevealText>
    </div>
    <div style={{ position: 'absolute', left: 100, right: 100, top: 582, textAlign: 'center' }}><RevealText at={55} size={108} serif ink={color.blue}>Hear the way.</RevealText></div>
    <div style={{ position: 'absolute', left: 100, right: 100, top: 760, textAlign: 'center', fontFamily: font.body, fontSize: 34, color: color.muted, opacity: ramp(f, 85, 30) }}>AI guidance for blind and low-vision people.</div>
  </AbsoluteFill>;
};

const Proof: React.FC = () => {
  const f = useCurrentFrame();
  const s = smooth(f, 0, 130);
  return <AbsoluteFill style={{ background: '#050b14', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, overflow: 'hidden', transform: `scale(${1 + s * 0.012}) translateY(${-4 * s}px)` }}>
      <OffthreadVideo muted src={staticFile('demo/live-demo.mp4')} trimBefore={Math.round(10.6 * 60)} style={{ position: 'absolute', left: 0, top: 125, width: 1920, height: 824, objectFit: 'contain' }} />
    </div>
    <AbsoluteFill style={{ background: 'linear-gradient(180deg,rgba(3,8,20,0.75),transparent 24%,transparent 61%,rgba(3,8,20,0.95))' }} />
    <Chapter number="02" text="THIS IS FINGERPOST IN ACTION" tag="Recorded phone demo" />
    <div style={{ position: 'absolute', left: 90, bottom: 220 }}>
      <RevealText at={6} size={92} serif>Point. Ask. Follow.</RevealText>
      <div style={{ marginTop: 22, opacity: ramp(f, 45, 25) }}><Pill>Meta vision <span style={{ opacity: 0.5 }}>→</span> SAM 3.1 <span style={{ opacity: 0.5 }}>→</span> local finger tracking</Pill></div>
    </div>
    <div style={{ position: 'absolute', right: 90, bottom: 178, display: 'flex', alignItems: 'center', gap: 14, fontFamily: font.body, fontSize: 24, color: color.peach, opacity: ramp(f, 100, 20) }}><div style={{ width: 10, height: 10, borderRadius: 20, background: color.peach }} />Actual recorded target + finger overlay</div>
  </AbsoluteFill>;
};

const Terminal: React.FC<{ approved?: boolean; target?: boolean; checking?: boolean }> = ({ approved = false, target = false, checking = false }) => <div style={{ width: 630, borderRadius: 34, background: color.night, padding: 34, boxShadow: '0 35px 80px rgba(15,28,53,0.2)', fontFamily: font.body, color: '#fff' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: color.nightText }}><span>JUNIPER / CHECKOUT</span><span>{approved ? 'CONFIRMED' : '02'}</span></div>
  <div style={{ marginTop: 50, fontSize: 30, color: color.nightText }}>Your order</div>
  <div style={{ marginTop: 15, display: 'flex', justifyContent: 'space-between', fontSize: 30 }}><span>Classic meal</span><span>12.40</span></div>
  <div style={{ height: 1, background: '#304267', margin: '36px 0' }} />
  <div style={{ fontSize: 24, color: color.nightText }}>TOTAL</div><div style={{ fontSize: 106, fontWeight: 650, letterSpacing: '-0.07em', margin: '4px 0 34px' }}>12.40</div>
  <div style={{ height: 105, background: approved ? color.peach : color.blue, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 35, fontWeight: 700, color: approved ? color.ink : '#fff', outline: target ? `4px solid ${color.peach}` : 'none', outlineOffset: 12 }}>{checking ? 'Checking the press…' : 'Pay by card'}</div>
  <div style={{ marginTop: 25, textAlign: 'center', color: color.nightText, fontSize: 23 }}>{approved ? 'Your yes unlocks guidance.' : 'No protected press without your yes.'}</div>
</div>;

const Confirm: React.FC = () => {
  const f = useCurrentFrame();
  const amount = f >= 81, yes = f >= 309;
  const slide = pop(f, 0);
  return <AbsoluteFill style={{ background: color.day, overflow: 'hidden' }}>
    <Grid light /><Chapter number="03" text="YOU CHOOSE. YOU CONFIRM." light tag="Illustrated payment flow" />
    <div style={{ position: 'absolute', left: 94, top: 215, width: 1000 }}>
      <div style={{ color: color.blue, fontFamily: font.body, fontWeight: 650, fontSize: 26, letterSpacing: '0.14em', marginBottom: 24 }}>YOU SAY</div>
      <RevealText at={0} ink={color.ink} size={116} serif>“Pay by card.”</RevealText>
      <div style={{ height: 2, width: 850 * smooth(f, 42, 25), background: '#dbe4f7', marginTop: 42, marginBottom: 35 }} />
      <div style={{ opacity: ramp(f, 81, 15), transform: `translateY(${(1 - pop(f, 81)) * 40}px)` }}>
        <div style={{ color: color.muted, fontFamily: font.body, fontSize: 26, letterSpacing: '0.12em', fontWeight: 650 }}>FINGERPOST CHECKS THE AMOUNT</div>
        <div style={{ fontFamily: font.body, fontSize: 100, fontWeight: 700, letterSpacing: '-0.05em', color: color.blue, marginTop: 18 }}>12.40</div>
        <div style={{ fontFamily: font.body, fontSize: 39, color: color.ink, width: 800, lineHeight: 1.35, marginTop: 12 }}>Say yes to pay,<br />or no to cancel.</div>
      </div>
      <div style={{ position: 'absolute', left: 555, top: 428, opacity: ramp(f, 309, 6), transform: `scale(${pop(f, 309, 14)}) rotate(${-8 * (1 - smooth(f, 309, 24))}deg)` }}><Pill dark={false}><Icon name="check" size={38} />Yes.</Pill></div>
    </div>
    <div style={{ position: 'absolute', left: 1170, top: 210, transform: `perspective(1600px) rotateY(${-10 + 5 * slide}deg) translateY(${(1 - slide) * 50}px)`, opacity: slide }}><Terminal approved={yes} target={amount} /></div>
  </AbsoluteFill>;
};

const Guide: React.FC = () => {
  const f = useCurrentFrame();
  const state = guideState(20 + f / 60);
  const label = state.stage === 'right' ? 'Move right.' : state.stage === 'up' ? 'Up a little.' : state.stage === 'on' ? 'Press now.' : state.stage === 'checking' ? 'Checking…' : 'Done.';
  const on = state.stage === 'on' || state.stage === 'checking' || state.stage === 'done';
  const target = { x: 1250, y: 555 };
  const x = 380 + state.x * 1160, y = 140 + state.y * 800;
  const hit = f >= 288 && f < 310 ? Math.exp(-(f - 288) / 7) * Math.sin((f - 288) * 2.5) * 7 : 0;
  const complete = state.stage === 'done';
  return <AbsoluteFill style={{ background: color.night, overflow: 'hidden', transform: `translateX(${hit}px)` }}>
    <Grid /><Chapter number="04" text="CLOSER. CLEARER. THERE." tag="Illustrated payment flow" />
    <div style={{ position: 'absolute', left: 90, top: 190 }}>
      <div style={{ fontFamily: font.body, fontSize: 26, fontWeight: 600, color: color.periwinkle, letterSpacing: '0.12em', marginBottom: 24 }}>{complete ? 'SCREEN CHANGE VERIFIED' : 'LISTEN TO THE GUIDANCE'}</div>
      <div key={label} style={{ fontFamily: font.display, fontSize: 113, letterSpacing: '-0.03em', color: on ? color.peach : '#fff', lineHeight: 1.03 }}>{label}</div>
      <div style={{ marginTop: 32, fontFamily: font.body, fontSize: 30, color: color.nightText }}>{state.stage === 'right' ? 'Follow the sound.' : state.stage === 'up' ? 'Pitch rises as you approach.' : state.stage === 'on' ? 'A double pulse. You are on target.' : state.stage === 'checking' ? 'A press is checked, never assumed.' : 'One more screen within reach.'}</div>
    </div>
    <div style={{ position: 'absolute', left: 890, top: 405, width: 760, height: 310, borderRadius: 24, background: complete ? '#193d40' : '#24365e', transform: `perspective(1600px) rotateX(${3 - smooth(f, 0, 160) * 3}deg) scale(${complete ? 1.015 : 1})`, boxShadow: '0 40px 100px rgba(0,0,0,0.2)' }}>
      <div style={{ padding: '30px 38px', fontFamily: font.body, color: color.nightText, fontSize: 24, display: 'flex', justifyContent: 'space-between' }}><span>JUNIPER / 12.40</span><span>{complete ? 'VERIFIED' : 'PAYMENT'}</span></div>
      <div style={{ position: 'absolute', left: 82, top: 95, width: 558, height: 110, borderRadius: 18, background: on ? color.peach : color.blue, color: on ? color.ink : '#fff', display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center', fontFamily: font.body, fontWeight: 700, fontSize: 44, transform: `scale(${1 - (f >= 315 && f < 325 ? 0.025 * Math.sin((f - 315) / 10 * Math.PI) : 0)})` }}>{complete ? <><Icon name="check" size={46} />Done.</> : 'Pay by card'}</div>
      <div style={{ position: 'absolute', left: 68, top: 81, width: 586, height: 138, borderRadius: 26, border: `3px solid ${color.peach}`, opacity: complete ? 0 : 0.8 }} />
    </div>
    <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0, opacity: complete ? 0 : 1 }}>
      <path d={`M${x} ${y}H${target.x}V${target.y}`} fill="none" stroke={color.periwinkle} strokeWidth="2" strokeDasharray="7 13" opacity="0.35" />
      {[0, 1, 2].map((i) => {
        const progress = ((f + i * 34) % 100) / 100;
        return <circle key={i} cx={target.x} cy={target.y} r={45 + progress * (on ? 100 : 140)} fill="none" stroke={on ? color.peach : color.periwinkle} strokeWidth={on ? 3 : 1.5} opacity={(1 - progress) * (on ? 0.65 : 0.23)} />;
      })}
      {!on ? <circle cx={x} cy={y} r="27" fill={color.peach} stroke="#fff" strokeWidth="5" /> : null}
      {!on ? <circle cx={x} cy={y} r="47" fill="none" stroke={color.peach} strokeWidth="2" opacity="0.6" /> : null}
      {state.stage === 'on' ? <><circle cx={target.x} cy={target.y} r="25" fill={color.peach} stroke={color.night} strokeWidth="5" /><circle cx={target.x} cy={target.y} r="44" fill="none" stroke="#fff" strokeWidth="3" /></> : null}
    </svg>
    <div style={{ position: 'absolute', left: 90, top: 605, width: 640 }}>
      <svg width="650" height="170" viewBox="0 0 650 170">
        <path d="M0 85h650" stroke="#304267" strokeWidth="1" />
        <path d={Array.from({ length: 220 }, (_, i) => {
          const t = i / 219;
          const amplitude = on ? 0 : 14 + (1 - state.error / 0.5) * 37;
          return `${i === 0 ? 'M' : 'L'}${t * 650},${85 + Math.sin(t * (8 + (1 - state.error / 0.5) * 23) * Math.PI + f * 0.2) * amplitude * Math.sin(t * Math.PI)}`;
        }).join(' ')} fill="none" stroke={on ? color.peach : color.periwinkle} strokeWidth="3" />
      </svg>
      <div style={{ display: 'flex', gap: 30, alignItems: 'center', fontFamily: font.body, fontSize: 24, color: color.nightText }}><Icon name={on ? 'haptic' : 'tone'} size={36} /><span>{on ? 'ON TARGET · DOUBLE CLICK' : 'SPATIAL TONE · RISING PITCH'}</span></div>
    </div>
    <div style={{ position: 'absolute', right: 118, top: 785, fontFamily: font.body, fontSize: 26, color: color.periwinkle, opacity: ramp(f, 30, 25) }}>VOICE <span style={{ margin: '0 18px', opacity: 0.4 }}>+</span> TONE <span style={{ margin: '0 18px', opacity: 0.4 }}>+</span> VIBRATION</div>
  </AbsoluteFill>;
};

const Privacy: React.FC = () => {
  const f = useCurrentFrame();
  const lock = pop(f, 7, 12);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];
  return <AbsoluteFill style={{ background: '#02050b', overflow: 'hidden' }}>
    <Chapter number="05" text="PIN PAD DETECTED" tag="LOCAL PIN MODE" />
    <div style={{ position: 'absolute', left: 90, top: 220 }}>
      <RevealText at={10} size={140}>Your PIN.</RevealText>
      <RevealText at={24} size={140} serif ink={color.peach}>Your business.</RevealText>
      <div style={{ marginTop: 50, fontFamily: font.body, fontSize: 39, color: '#fff', opacity: ramp(f, 45, 20) }}>Nothing uploaded.<br /><span style={{ color: color.nightText }}>Microphone off.</span></div>
      <div style={{ display: 'flex', gap: 20, marginTop: 48, transform: `translateX(${f < 23 ? Math.sin(f * 2.3) * (1 - f / 23) * 7 : 0}px)` }}>
        {(['cloud', 'mic'] as const).map((name, i) => <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 15, borderRadius: 16, padding: '15px 22px', background: '#211817', color: color.peach, fontFamily: font.body, fontSize: 27, fontWeight: 650, transform: `scale(${0.9 + lock * 0.1})` }}><Icon name={name} size={42} off={ramp(f, 4 + i * 3, 5)} />{name === 'cloud' ? 'UPLOAD OFF' : 'MIC OFF'}</div>)}
      </div>
    </div>
    <div style={{ position: 'absolute', left: 1240, top: 200, width: 480, padding: 35, borderRadius: 32, background: '#121c2f', transform: `perspective(1500px) rotateY(${-8 + smooth(f, 0, 100) * 8}deg) translateY(${(1 - pop(f, 0)) * 70}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: color.peach, fontFamily: font.body, fontSize: 29, fontWeight: 650, marginBottom: 27 }}><Icon name="lock" size={45} />Local. On your phone.</div>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', padding: '18px 0 38px' }}>{[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 20, height: 20, borderRadius: 20, border: '2px solid #627292' }} />)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>{keys.map((key, i) => <div key={i} style={{ height: 87, display: 'grid', placeItems: 'center', borderRadius: 15, background: key ? '#1f2c43' : 'transparent', color: '#9eabc4', fontFamily: font.body, fontSize: 36 }}>{key}</div>)}</div>
    </div>
    <div style={{ position: 'absolute', right: 230, top: 850, color: color.peach, fontFamily: font.body, fontSize: 24, letterSpacing: '0.1em', opacity: ramp(f, 50, 20) }}>CLOUD DISCONNECTED</div>
  </AbsoluteFill>;
};

const Modes: React.FC = () => {
  const f = useCurrentFrame();
  const items = [{ name: 'Voice', icon: 'voice' as const, at: 10 }, { name: 'Tone', icon: 'tone' as const, at: 55 }, { name: 'Vibration', icon: 'haptic' as const, at: 100 }];
  return <AbsoluteFill style={{ background: color.day, overflow: 'hidden' }}>
    <Chapter number="06" text="MORE THAN ONE WAY TO FIND IT" light />
    <div style={{ position: 'absolute', left: 90, top: 180 }}><RevealText at={0} size={104} serif ink={color.ink}>Guidance you can hear. Or feel.</RevealText></div>
    <div style={{ position: 'absolute', left: 90, right: 90, top: 385, display: 'flex', gap: 25 }}>
      {items.map((item, i) => {
        const p = pop(f, item.at);
        const active = f >= item.at && (i === 2 || f < items[i + 1]!.at);
        return <div key={item.name} style={{ flex: 1, height: 300, borderRadius: 24, background: i === 1 ? color.blue : color.panel, color: i === 1 ? '#fff' : color.ink, padding: 32, transform: `translateY(${(1 - p) * 80}px) rotate(${(1 - p) * (i - 1) * 6}deg)`, opacity: ramp(f, item.at, 12) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Icon name={item.icon} size={60} /><div style={{ fontFamily: font.body, fontSize: 20, letterSpacing: '0.1em', opacity: 0.6 }}>0{i + 1}</div></div>
          <div style={{ height: 87, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>{i === 2 ? <div style={{ display: 'flex', gap: 12, transform: `translateX(${active ? Math.sin(f * 1.4) * 3 : 0}px)` }}>{[0, 1, 2, 3, 4].map((n) => <span key={n} style={{ width: 20, height: n % 2 ? 30 : 45, borderRadius: 5, background: color.blue, opacity: active ? 0.45 + 0.55 * Math.abs(Math.sin((f - 100) / 10 + n)) : 0.35 }} />)}</div> : <MiniWave frame={f} active={active} ink={i === 1 ? '#fff' : color.blue} width={390} />}</div>
          <div style={{ fontFamily: font.body, fontSize: 53, fontWeight: 650, letterSpacing: '-0.04em' }}>{item.name}</div>
        </div>;
      })}
    </div>
    <div style={{ position: 'absolute', left: 90, right: 90, top: 755, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: ramp(f, 165, 25), transform: `translateY(${(1 - smooth(f, 165, 25)) * 20}px)` }}>
      <div style={{ fontFamily: font.body, fontSize: 39, fontWeight: 600, color: color.blue }}>English <span style={{ margin: '0 24px', color: '#a5b3ce' }}>/</span> हिन्दी <span style={{ margin: '0 24px', color: '#a5b3ce' }}>/</span> Español</div>
      <div style={{ fontFamily: font.body, fontSize: 28, color: color.muted }}>Built for blind and low-vision people.</div>
    </div>
  </AbsoluteFill>;
};

const Glasses: React.FC = () => {
  const f = useCurrentFrame();
  const p = smooth(f, 20, 130);
  return <AbsoluteFill style={{ background: color.night, overflow: 'hidden' }}>
    <Grid /><Chapter number="07" text="THE NEXT POINT OF VIEW" tag="NEXT · CONCEPT" />
    <div style={{ position: 'absolute', left: 90, top: 180 }}><RevealText at={5} size={78} ink={color.periwinkle}>Meta camera glasses.</RevealText></div>
    <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0, opacity: 0.24 * p }}>
      {[1, 2, 3, 4].map((i) => <ellipse key={i} cx="1050" cy="470" rx={i * 180 + f * 0.2} ry={i * 75} stroke={color.periwinkle} strokeWidth="1" fill="none" transform={`rotate(-18 1050 470)`} />)}
    </svg>
    <div style={{ position: 'absolute', left: 590, top: 260, transform: `translateY(${(1 - pop(f, 15)) * 50}px) scale(${0.95 + smooth(f, 0, 420) * 0.12})` }}><GlassesDrawing frame={f - 10} /></div>
    <div style={{ position: 'absolute', left: 125, top: 355, transform: `perspective(1000px) rotateY(${-28 + p * 10}deg) translateX(${-p * 80}px) scale(${1 - p * 0.13})`, opacity: 1 - p * 0.78 }}>
      <div style={{ width: 160, height: 290, borderRadius: 27, border: '7px solid #60789f', background: '#18294c', display: 'grid', placeItems: 'center' }}><Ring size={102} /></div>
      <div style={{ color: color.nightText, fontFamily: font.body, fontSize: 24, textAlign: 'center', marginTop: 22 }}>PHONE · TODAY</div>
    </div>
    <div style={{ position: 'absolute', left: 390, top: 460, color: color.periwinkle, opacity: p }}><Icon name="arrow" size={100} /></div>
    <div style={{ position: 'absolute', left: 90, top: 718 }}><RevealText at={120} size={132} serif>Completely hands-free.</RevealText></div>
    <div style={{ position: 'absolute', right: 110, top: 850, fontFamily: font.body, fontSize: 25, color: color.periwinkle, opacity: ramp(f, 170, 30) }}>The same camera interface. A future form factor.</div>
    {f > 485 ? <div style={{ position: 'absolute', left: '50%', top: '50%', width: 140, height: 140, borderRadius: '50%', background: color.blue, transform: `translate(-50%,-50%) scale(${smooth(f, 485, 55) * 20})` }} /> : null}
  </AbsoluteFill>;
};

const Close: React.FC = () => {
  const f = useCurrentFrame();
  const p = pop(f, 6);
  return <AbsoluteFill style={{ background: color.blue, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: '50%', top: 375, transform: `translate(-50%,-50%) scale(${0.8 + p * 0.2})` }}><Ring size={235} progress={smooth(f, 0, 60)} /></div>
    <div style={{ position: 'absolute', left: 80, right: 80, top: 500, textAlign: 'center' }}><RevealText at={15} size={186} serif>Fingerpost.</RevealText></div>
    <div style={{ position: 'absolute', left: 80, right: 80, top: 720, textAlign: 'center' }}><RevealText at={42} size={65} ink={color.peach} serif>Hear the way.</RevealText></div>
    <div style={{ position: 'absolute', left: 90, right: 90, top: 855, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: font.body, color: '#fff', fontSize: 27, opacity: ramp(f, 70, 30) }}><span>FREE & OPEN SOURCE <span style={{ margin: '0 18px', opacity: 0.5 }}>/</span> ANDROID PROTOTYPE</span><span>github.com/Sky-walkerX/fingerpost</span></div>
    <AbsoluteFill style={{ background: color.night, opacity: ramp(f, 316, 14), pointerEvents: 'none' }} />
  </AbsoluteFill>;
};

export const sensorySceneComponents: Record<SensorySceneId, React.FC> = { tension: Tension, reveal: Reveal, proof: Proof, confirm: Confirm, guide: Guide, privacy: Privacy, modes: Modes, glasses: Glasses, close: Close };
