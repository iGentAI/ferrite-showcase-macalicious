/*
 * Stand-in picture for the Spotlight pane: an original drawing of a magnifying glass on a blue
 * disc, 50 x 50 pt, in place of Apple's icon.
 */

import { useId } from "react";

/** The picture beside the pane's introduction. Decorative. */
export function SpotlightArtwork() {
  const disc = useId();
  return (
    <svg width="50" height="50" viewBox="0 0 50 50" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={disc} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#55b1f7" />
          <stop offset="1" stopColor="#1c78ec" />
        </linearGradient>
      </defs>
      <circle cx="25" cy="25" r="25" fill={`url(#${disc})`} />
      <circle cx="22" cy="22" r="9.5" fill="none" stroke="#ffffff" strokeWidth="3" />
      <path d="M29.5 29.5l8 8" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
