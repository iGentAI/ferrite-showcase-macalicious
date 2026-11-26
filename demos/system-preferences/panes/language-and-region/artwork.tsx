/*
 * Stand-in picture for the Language & Region pane: an original drawing of a blue flag with a
 * globe on a pole, on the 41 x 37 pt frame of the pane, in place of Apple's icon.
 */

import { useId } from "react";

/** The picture beside the pane's introduction. Decorative. */
export function FlagArtwork() {
  const cloth = useId();
  return (
    <svg width="41" height="37" viewBox="0 0 41 37" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={cloth} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d9bf2" />
          <stop offset="1" stopColor="#1f6fd6" />
        </linearGradient>
      </defs>
      {/* Pole */}
      <rect x="0.5" y="1" width="2" height="36" rx="1" fill="#a9abb0" />
      {/* Cloth, with a slight wave */}
      <path
        d="M3 3.5c7-2.5 12 2 19 1.5s12-3 19-1.5v24c-7-1.5-12 1-19 1.5s-12-4-19-1.5z"
        fill={`url(#${cloth})`}
      />
      {/* Globe */}
      <g fill="none" stroke="#ffffff" strokeWidth="1.2">
        <circle cx="22" cy="16" r="7.5" />
        <ellipse cx="22" cy="16" rx="3.2" ry="7.5" />
        <path d="M14.5 16h15M15.6 12h12.8M15.6 20h12.8" />
      </g>
    </svg>
  );
}
