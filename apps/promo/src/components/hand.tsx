/** A simple illustrated pointing hand, index finger up. Drawn, not photographic. */
export const Hand: React.FC<{ width: number; style?: React.CSSProperties; tone?: [string, string] }> = ({ width, style, tone = ['#dfe6f3', '#9fb0d1'] }) => (
  <svg width={width} viewBox="-60 -30 260 530" style={style} aria-hidden="true">
    <defs>
      <linearGradient id="hand-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={tone[0]} />
        <stop offset="1" stopColor={tone[1]} />
      </linearGradient>
    </defs>
    <g fill="url(#hand-g)">
      <rect x="20" y="-20" width="42" height="210" rx="21" />
      <rect x="0" y="125" width="170" height="175" rx="62" />
      <rect x="62" y="100" width="40" height="86" rx="20" />
      <rect x="104" y="110" width="38" height="78" rx="19" />
      <rect x="142" y="128" width="32" height="64" rx="16" />
      <rect x="-28" y="150" width="44" height="110" rx="22" transform="rotate(-32 -6 205)" />
      <path d="M28 250 C 24 330, 30 420, 40 500 L 142 500 C 150 420, 156 330, 150 250 Z" />
    </g>
  </svg>
);
