/** A CSS 3D box centred on its origin. Faces are lit by gradients rather than outlined. */
export type Faces = Partial<Record<'front' | 'back' | 'left' | 'right' | 'top' | 'bottom', React.CSSProperties>>;

export const Box3D: React.FC<{ w: number; h: number; d: number; at?: [number, number, number]; faces: Faces; front?: React.ReactNode; radius?: number }> = ({ w, h, d, at = [0, 0, 0], faces, front, radius = 0 }) => {
  const face = (fw: number, fh: number, transform: string, style: React.CSSProperties | undefined, child?: React.ReactNode) =>
    style ? (
      <div style={{ position: 'absolute', left: -fw / 2, top: -fh / 2, width: fw, height: fh, transform, backfaceVisibility: 'hidden', ...style }}>{child}</div>
    ) : null;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d', transform: `translate3d(${at[0]}px, ${at[1]}px, ${at[2]}px)` }}>
      {face(w, h, `translateZ(${d / 2}px)`, faces.front && { borderRadius: radius, ...faces.front }, front)}
      {face(w, h, `rotateY(180deg) translateZ(${d / 2}px)`, faces.back && { borderRadius: radius, ...faces.back })}
      {face(d, h, `rotateY(90deg) translateZ(${w / 2}px)`, faces.right)}
      {face(d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, faces.left)}
      {face(w, d, `rotateX(90deg) translateZ(${h / 2}px)`, faces.top)}
      {face(w, d, `rotateX(-90deg) translateZ(${h / 2}px)`, faces.bottom)}
    </div>
  );
};
