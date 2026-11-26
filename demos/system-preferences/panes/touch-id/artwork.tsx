import { useId } from "react";

/*
 * Stand-ins for the pane's pictures: original drawings in place of Apple's fingerprint artwork.
 * A print is a set of nested arches around a core, drawn on a 48 pt square.
 */

const ARCHES = [3.5, 7.4, 11.3, 15.2, 19.1, 23];

function Ridges({ color, width }: { color: string; width: number }) {
  return (
    <g fill="none" stroke={color} strokeWidth={width} strokeLinecap="round">
      <path d="M24 24v21" />
      {ARCHES.map((radius) => (
        <path
          key={radius}
          d={`M${24 - radius} ${46 - radius * 0.6}V24a${radius} ${radius} 0 0 1 ${radius * 2} 0V${46 - radius * 0.6}`}
        />
      ))}
    </g>
  );
}

/** The large picture in the left region: a pale disc with a pink print, 113 pt across. */
export function TouchIdArtwork() {
  const fill = useId();
  return (
    <svg width="113" height="113" viewBox="0 0 113 113" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbfbfb" />
          <stop offset="1" stopColor="#e2e2e2" />
        </linearGradient>
      </defs>
      <circle cx="56.5" cy="56.5" r="56" fill={`url(#${fill})`} stroke="#c9c9c9" />
      <g transform="translate(16.5 15.5) scale(1.667)">
        <Ridges color="#ff3766" width={1.5} />
      </g>
    </svg>
  );
}

/** A saved fingerprint: a grey print without a disc, 48 pt across. */
export function FingerprintArtwork() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <Ridges color="#98989d" width={1.6} />
    </svg>
  );
}

/** The tile that adds a fingerprint: a black disc with a grey plus 26 pt across. */
export function AddFingerprintArtwork() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="24" fill="#000000" />
      <path d="M11 24h26M24 11v26" fill="none" stroke="#8e8d92" strokeWidth="1.5" />
    </svg>
  );
}
