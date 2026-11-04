import { color } from '../tokens.ts';

/** The ring-and-fingertip mark from the app icon and website. */
export const BrandMark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 30 30" style={style} aria-hidden="true">
    <circle cx="15" cy="15" r="14" fill={color.blue} />
    <circle cx="15" cy="15" r="9" fill="none" stroke="#fff" strokeWidth="1.6" opacity="0.55" />
    <circle cx="15" cy="15" r="4.5" fill={color.peach} />
  </svg>
);
