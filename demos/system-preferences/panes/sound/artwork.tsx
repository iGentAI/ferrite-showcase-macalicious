/*
 * Stand-in speaker glyphs for the two ends of a volume slider: original drawings of a speaker
 * silhouette, alone for quiet and with three arcs for loud, on the allocations measured in the
 * capture (12.5 x 18.5 pt and 31 x 24 pt). They take the colour of the text around them.
 */

/** The quiet end: a speaker. Decorative. */
export function SpeakerLow() {
  return (
    <svg width="12.5" height="18.5" viewBox="0 0 12.5 18.5" aria-hidden="true" focusable="false">
      <path d="M0 6h4.5l7-5.5a.6.6 0 0 1 1 .5v16.5a.6.6 0 0 1-1 .5l-7-5.5H0z" fill="currentColor" />
    </svg>
  );
}

/** The loud end: a speaker and three arcs. Decorative. */
export function SpeakerHigh() {
  return (
    <svg width="31" height="24" viewBox="0 0 31 24" aria-hidden="true" focusable="false">
      <path
        d="M0 8.75h4.5l7-5.5a.6.6 0 0 1 1 .5v16.5a.6.6 0 0 1-1 .5l-7-5.5H0z"
        fill="currentColor"
      />
      <path
        d="M16 7.5a6.5 6.5 0 0 1 0 9M20.5 4.25a11.5 11.5 0 0 1 0 15.5M25 1a16.5 16.5 0 0 1 0 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
