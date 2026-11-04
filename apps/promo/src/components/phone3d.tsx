import { interpolate, useCurrentFrame } from 'remotion';
import { color } from '../tokens.ts';
import { Box3D } from './box3d.tsx';
import { KioskScreen } from './kiosk-screen.tsx';

const Bracket: React.FC<{ corner: 0 | 1 | 2 | 3; size: number }> = ({ corner, size }) => {
  const top = corner < 2, left = corner % 2 === 0;
  return <div style={{
    position: 'absolute', width: size, height: size, [top ? 'top' : 'bottom']: 0, [left ? 'left' : 'right']: 0,
    borderColor: color.peach, borderStyle: 'solid', borderWidth: 0,
    [top ? 'borderTopWidth' : 'borderBottomWidth']: 6, [left ? 'borderLeftWidth' : 'borderRightWidth']: 6,
    [`border${top ? 'Top' : 'Bottom'}${left ? 'Left' : 'Right'}Radius`]: 14,
  }} />;
};

/** The phone's live camera view of the kiosk display, with brackets that lock on as `lock` goes 0 → 1. */
const CameraView: React.FC<{ lock: number }> = ({ lock }) => {
  const frame = useCurrentFrame();
  const scanY = interpolate(frame % 70, [0, 70], [8, 92]);
  const pad = 26 + (1 - lock) * 40;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #e4eaf5, #cbd5e8)', display: 'grid', placeItems: 'center' }}>
      <div style={{ position: 'relative', transform: 'perspective(900px) rotateY(-10deg) rotateX(4deg)' }}>
        <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 0 0 8px #e7ecf5, 0 24px 36px -18px rgba(13,24,48,0.45)' }}><KioskScreen width={230} /></div>
        <div style={{ position: 'absolute', inset: -pad, opacity: 0.35 + 0.65 * lock }}>
          {([0, 1, 2, 3] as const).map((c) => <Bracket key={c} corner={c} size={44} />)}
        </div>
      </div>
      {lock < 1 ? <div style={{ position: 'absolute', left: 24, right: 24, top: `${scanY}%`, height: 3, borderRadius: 2, background: color.periwinkle, boxShadow: `0 0 16px ${color.periwinkle}`, opacity: 0.85 * (1 - lock) }} /> : null}
    </div>
  );
};

/** A thin-bezel phone in 3D. Its screen shows what its camera sees. */
export const Phone3D: React.FC<{ lock: number }> = ({ lock }) => (
  <Box3D w={360} h={740} d={22} radius={58}
    faces={{ front: { background: 'linear-gradient(160deg, #1f3260, #0d1830)', padding: 9, boxSizing: 'border-box', boxShadow: '0 40px 80px -30px rgba(13,24,48,0.55)' }, back: { background: '#16264a' }, right: { background: 'linear-gradient(180deg, #24365e, #16264a)', borderRadius: 11 }, left: { background: 'linear-gradient(180deg, #2c3f6b, #1b2c55)', borderRadius: 11 }, top: { background: '#2c3f6b', borderRadius: 11 } }}
    front={
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 46, overflow: 'hidden' }}>
        <CameraView lock={lock} />
        <div style={{ position: 'absolute', top: 16, left: '50%', width: 110, height: 30, marginLeft: -55, borderRadius: 15, background: color.night }} />
      </div>
    } />
);
