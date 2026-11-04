import { interpolate, useCurrentFrame } from 'remotion';
import { Box3D } from './box3d.tsx';
import { KioskScreen } from './kiosk-screen.tsx';

const body = {
  front: { background: 'linear-gradient(180deg, #f4f7fc 0%, #dde5f2 100%)' },
  right: { background: 'linear-gradient(180deg, #c7d2e6 0%, #a9b7d2 100%)' },
  left: { background: 'linear-gradient(180deg, #edf1f8 0%, #d6deec 100%)' },
  top: { background: '#f9fbfe' },
};

/** A freestanding self-checkout: head unit with a recessed glass display, a column and a base, standing on a soft shadow. */
export const Kiosk3D: React.FC = () => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame % 150, [0, 150], [-120, 120]);
  return (
    <div style={{ position: 'absolute', transformStyle: 'preserve-3d' }}>
      <div style={{ position: 'absolute', left: -560, top: 778 - 420, width: 1120, height: 840, transform: 'rotateX(90deg)', background: 'radial-gradient(closest-side, rgba(13,24,48,0.28), rgba(13,24,48,0))', filter: 'blur(18px)' }} />
      <Box3D w={560} h={28} d={380} at={[0, 764, -20]} faces={body} radius={14} />
      <Box3D w={240} h={600} d={180} at={[0, 450, -20]} faces={body} />
      <Box3D w={680} h={900} d={130} at={[0, -300, 0]} faces={body} radius={34} front={
        <div style={{ position: 'absolute', left: 40, top: 46, width: 600, height: 800, borderRadius: 22, overflow: 'hidden', boxShadow: '0 0 0 14px #e7ecf5, 0 0 0 15px rgba(13,24,48,0.06), 0 8px 24px -6px rgba(13,24,48,0.28)' }}>
          <KioskScreen width={600} />
          <div style={{ position: 'absolute', inset: '-30%', background: 'linear-gradient(120deg, transparent 44%, rgba(255,255,255,0.22) 50%, transparent 56%)', transform: `translateX(${sweep}%)` }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 22, boxShadow: 'inset 0 3px 14px rgba(13,24,48,0.18)' }} />
        </div>
      } />
    </div>
  );
};
