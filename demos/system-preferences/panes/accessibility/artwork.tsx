import { type CSSProperties, type ReactNode, useId } from "react";

/*
 * Stand-ins for the pane's pictures: original drawings in place of Apple's emblem and category
 * icons. Each category's drawing has the footprint measured in the captures, so the rows keep
 * their balance.
 */

/** The categories that have a picture. */
export type CategoryIcon =
  | "overview"
  | "voiceover"
  | "zoom"
  | "display"
  | "speech"
  | "descriptions"
  | "audio"
  | "captions";

/**
 * A figure with its arms out, drawn in a square of 100 units and placed with its top-left
 * corner at `x`, `y` at `size` points across.
 */
function Figure({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 100})`}>
      <circle cx="50" cy="24" r="8" fill={color} />
      <path
        d="M22 40h56M50 40v20M50 60l-12 24M50 60l12 24"
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A blue disc with a white ring and the figure, `size` points across, centred on cx, cy. */
function Disc({ cx, cy, size, fill }: { cx: number; cy: number; size: number; fill: string }) {
  const r = size / 2;
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${fill})`} />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.84}
        fill="none"
        stroke="#ffffff"
        strokeWidth={Math.max(1, size * 0.045)}
      />
      <Figure x={cx - r} y={cy - r} size={size} color="#ffffff" />
    </>
  );
}

function BlueFill({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#2ba5f9" />
      <stop offset="1" stopColor="#0a6ee6" />
    </linearGradient>
  );
}

/** The emblem of the Overview: the blue disc with the figure, 57 pt across. */
export function AccessibilityEmblem() {
  const fill = useId();
  return (
    <svg width="57" height="57" viewBox="0 0 57 57" aria-hidden="true" focusable="false">
      <defs>
        <BlueFill id={fill} />
      </defs>
      <Disc cx={28.5} cy={28.5} size={57} fill={fill} />
    </svg>
  );
}

/** A flat display with a stand: the screen's box, and what fills it. */
function Monitor({
  x,
  y,
  width,
  height,
  screen,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  screen: string;
}) {
  const middle = x + width / 2;
  const foot = y + height;
  return (
    <>
      <rect x={x} y={y} width={width} height={height} rx="1.5" fill="#1c1c1e" />
      <rect x={x + 1.5} y={y + 1.5} width={width - 3} height={height - 3} fill={screen} />
      <path
        d={`M${middle - 3} ${foot}h6l1 3.5h3.5v1.5h-15v-1.5h3.5z`}
        fill="#b9b9bd"
        stroke="#8e8e93"
        strokeWidth="0.5"
      />
    </>
  );
}

/**
 * The drawings, on the leading 32 pt of a row from 2 pt under its top edge: a drawing's
 * coordinates are the measured ones less the row's corner.
 */
const DRAWINGS: Record<CategoryIcon, (fill: string) => ReactNode> = {
  overview: (fill) => <Disc cx={16} cy={18.25} size={29} fill={fill} />,
  voiceover: () => (
    <>
      <rect x="1.5" y="4.5" width="29" height="29.5" rx="4" fill="#d2d2d6" stroke="#9a9a9e" />
      <circle cx="16" cy="22.5" r="8.5" fill="#77777c" stroke="#5a5a5f" />
      <Figure x={8.5} y={15} size={15} color="#f2f2f2" />
      <path d="M5 8.5v3h1.5l2.5 2v-7l-2.5 2z" fill="#6e6e73" />
      <path d="M10.5 8a3 3 0 0 1 0 4M12.5 6.5a5 5 0 0 1 0 7" fill="none" stroke="#6e6e73" />
    </>
  ),
  zoom: () => (
    <>
      <rect x="4" y="10" width="27" height="23" rx="2" fill="#3a9ff2" />
      <rect x="14" y="17" width="14.5" height="13.5" fill="#ffffff" />
      <circle cx="8.75" cy="13.75" r="8" fill="#f1f1f3" stroke="#8e8e93" strokeWidth="1.5" />
      <circle cx="11" cy="16" r="3" fill="#f0655c" />
    </>
  ),
  display: () => <Monitor x={0} y={8.5} width={32} height={20} screen="#2f8ef0" />,
  speech: () => (
    <>
      <Monitor x={0} y={13} width={22} height={14.5} screen="#2f8ef0" />
      <path
        d="M23 7c4.7 0 8.5 2.7 8.5 6s-3.8 6-8.5 6c-1 0-2-.1-2.9-.4L16 20.5l1.7-3.5c-2-1.1-3.2-2.5-3.2-4 0-3.3 3.8-6 8.5-6z"
        fill="#f4f4f6"
        stroke="#a2a2a7"
      />
    </>
  ),
  descriptions: (fill) => (
    <>
      <rect x="1" y="6" width="30" height="20" rx="1.5" fill={`url(#${fill}-dusk)`} />
      <rect x="1" y="6" width="30" height="3" fill="#3b3466" />
      <path
        d="M10 21h12a5 5 0 0 1 0 10h-7l-3.5 2.5.5-2.8A5 5 0 0 1 10 21z"
        fill="#f4f4f6"
        stroke="#a2a2a7"
      />
      <g fill="none" stroke="#7c7c81">
        <circle cx="11.5" cy="26" r="1.5" />
        <circle cx="16" cy="26" r="1.5" />
        <circle cx="20.5" cy="26" r="1.5" />
      </g>
    </>
  ),
  audio: () => (
    <>
      <path d="M3 15h7l11-9.5v29L10 25H3z" fill="#58585c" stroke="#3a3a3c" />
      <ellipse cx="22" cy="19.5" rx="7.5" ry="15" fill="#2c2c2e" stroke="#8e8e93" />
      <ellipse cx="22.5" cy="19.5" rx="3" ry="6.5" fill="#77777c" />
    </>
  ),
  captions: () => (
    <>
      <path
        d="M4.5 7h23A3.5 3.5 0 0 1 31 10.5v14a3.5 3.5 0 0 1-3.5 3.5H25l-1 5-5-5H4.5A3.5 3.5 0 0 1 1 24.5v-14A3.5 3.5 0 0 1 4.5 7z"
        fill="#48484a"
      />
      <path
        d="M6 18h6M14.5 18h11.5M6 22.5h3.5M12 22.5h7M21.5 22.5h4.5"
        fill="none"
        stroke="#f2f2f7"
        strokeWidth="1.5"
      />
    </>
  ),
};

/**
 * The picture of a category in the list: 32 pt wide and as tall as its row less the 2 pt above
 * it, so that each drawing sits where the captures have it.
 */
export function CategoryArtwork({
  icon,
  height = 38,
  style,
}: {
  icon: CategoryIcon;
  /** The row's height less 2. */
  height?: number;
  style?: CSSProperties;
}) {
  const fill = useId();
  return (
    <svg
      width="32"
      height={height}
      viewBox={`0 0 32 ${height}`}
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <defs>
        <BlueFill id={fill} />
        <linearGradient id={`${fill}-dusk`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b3f8f" />
          <stop offset="1" stopColor="#e58aa2" />
        </linearGradient>
      </defs>
      {DRAWINGS[icon](fill)}
    </svg>
  );
}
