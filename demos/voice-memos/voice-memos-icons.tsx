/**
 * The glyphs of the Voice Memos demo. All are original drawings to the measured sizes: none is
 * Apple's artwork. They take the colour of the text around them.
 */

/** The toolbar's Trim button: a crop mark, two corners that cross. */
export function TrimGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M3.5 .5v10h10M.5 3.5h10v10" fill="none" stroke="currentColor" />
    </svg>
  );
}

/**
 * Skip 15 seconds, 20 x 21.5 pt as measured: an open ring whose arrowhead points the way the
 * position moves, around the number.
 */
export function SkipGlyph({ direction }: { direction: "back" | "forward" }) {
  return (
    <svg width="20" height="21.5" viewBox="0 0 20 21.5" aria-hidden="true" focusable="false">
      {/* Drawn for "back" and mirrored for "forward"; the number is drawn over it unmirrored. */}
      <g transform={direction === "forward" ? "translate(20 0) scale(-1 1)" : undefined}>
        <path
          d="M10 3.1a8.75 8.75 0 1 1 -7.5 4.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M5 3.3 10.6 0v6.6z" fill="currentColor" />
      </g>
      <path
        d="M5.6 9.8 7.4 8.6v6.8M14.2 8.6h-3.2l-.4 2.9c2 -.9 3.9 0 3.9 1.9 0 2 -2.4 2.8 -4.2 1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Play: a triangle with eased corners, 25 x 28 pt as measured. */
export function PlayGlyph() {
  return (
    <svg width="25" height="28" viewBox="0 0 25 28" aria-hidden="true" focusable="false">
      <path
        d="M2.25 2.25v23.5L22.75 14z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Pause, in the box of the play triangle: what the play button shows while it plays. */
export function PauseGlyph() {
  return (
    <svg width="25" height="28" viewBox="0 0 25 28" aria-hidden="true" focusable="false">
      <path d="M3 2h6.5v24H3zM15.5 2H22v24h-6.5z" fill="currentColor" />
    </svg>
  );
}

/**
 * The pause mark of the record pill: two bars of 7.85 x 19 pt, 2.95 pt apart, as measured,
 * each with the dark row of pixels the captures have around it.
 */
export function RecordPauseGlyph() {
  return (
    <svg
      width="19.65"
      height="20"
      viewBox="-0.5 -0.5 19.65 20"
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
      stroke="var(--mac-voice-memos-pill-edge)"
      paintOrder="stroke"
    >
      <rect width="7.85" height="19" rx="1.25" />
      <rect x="10.8" width="7.85" height="19" rx="1.25" />
    </svg>
  );
}
