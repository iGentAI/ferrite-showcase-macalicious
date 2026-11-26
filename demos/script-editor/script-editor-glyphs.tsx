/*
 * Original drawings that stand in for Script Editor's toolbar and bottom bar artwork. Each
 * takes the colour of its button (`currentColor`), except the record dot, whose red is the
 * demo's token.
 */

/** Record: a filled circle, 14 pt. */
export function RecordGlyph() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className="mac-script-editor-record"
    >
      <circle cx="7" cy="7" r="7" fill="currentColor" />
    </svg>
  );
}

/** Stop: a filled square, 14 pt. */
export function StopGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 14 14">
      <rect width="14" height="14" fill="currentColor" />
    </svg>
  );
}

/** Run: a triangle that points right, 12 by 14 pt. */
export function RunGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" width="12" height="14" viewBox="0 0 12 14">
      <path d="M0 0l12 7-12 7z" fill="currentColor" />
    </svg>
  );
}

/** Compile: a hammer, 14 pt. */
export function CompileGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 14 14">
      <path
        d="M1.2 12.8l6.2-7.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M4.6 2.3c2.3-1.5 5-1.5 7.4.4l1 3-1.5.4-1.2-1.6-2.2 2-1.9-1.8z" fill="currentColor" />
    </svg>
  );
}

/** The accessory view at the bottom of the window: a frame with a bar along its lower edge. */
export function BottomPaneGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" width="18" height="14" viewBox="0 0 18 14">
      <rect x="0.5" y="0.5" width="17" height="13" fill="none" stroke="currentColor" />
      <rect x="2" y="9" width="14" height="3" fill="currentColor" />
    </svg>
  );
}

/** The pane at the side of the window: a frame with a bar along its trailing edge. */
export function SidePaneGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" width="18" height="14" viewBox="0 0 18 14">
      <rect x="0.5" y="0.5" width="17" height="13" fill="none" stroke="currentColor" />
      <rect x="13" y="2" width="3" height="10" fill="currentColor" />
    </svg>
  );
}

/** Description: a lower-case i in a circle, 15 pt. */
export function DescriptionGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 15 15">
      <circle cx="7.5" cy="7.5" r="6.9" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="7.5" cy="4.3" r="1.05" fill="currentColor" />
      <path d="M5.9 6.4h2.4v4.3h1.2v1H5.7v-1h1.3V7.4H5.9z" fill="currentColor" />
    </svg>
  );
}

/** Result: an arrow that turns back to the left, as on a Return key. */
export function ResultGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" width="13" height="13" viewBox="0 0 13 13">
      <path
        d="M11.5 1v7.5H1.5M5.5 4.8L1.5 8.5l4 3.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}

/** Log: three lines in a frame. */
export function LogGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="13" viewBox="0 0 14 13">
      <path
        d="M0.55 0.55h12.9v11.9H0.55zM3 3.7h8M3 6.5h8M3 9.3h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}

/** Library: three books on a shelf, the last one leaning. Shown only on the desktop's server. */
export function LibraryGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" width="14" height="13" viewBox="0 0 14 13">
      <path
        d="M0.55 0.55h3v11.9h-3zM4.55 2.55h3v9.9h-3zM8.6 2.2l2.9-0.8 2.5 10.6-2.9 0.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}
