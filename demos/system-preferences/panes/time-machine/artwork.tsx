/*
 * Stand-in pictures for the Time Machine pane: original drawings in place of Apple's artwork,
 * on the measured boxes. Each is decorative: the text beside it names what it stands for.
 */

import { useId } from "react";

/** A clock face inside an arrow that turns backwards, drawn in white on a 24 x 24 box. */
function ClockGlyph({ transform, strokeWidth }: { transform: string; strokeWidth: number }) {
  return (
    <g
      transform={transform}
      fill="none"
      stroke="#f4f6f6"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <path d="M4.2 13.5A8 8 0 1 0 6.3 6.4" />
      <path d="M12 7v5.2l3 2.4" strokeLinejoin="round" />
      <path d="M1.6 11.2l2.7 3.6 3-3.3z" fill="#f4f6f6" stroke="none" />
    </g>
  );
}

/** The pane's picture, 112 x 112 pt: a dark green disc in a pale rim with the clock glyph. */
export function ClockPicture() {
  const id = useId();
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d6d8d8" />
        </linearGradient>
        <linearGradient id={`${id}-disc`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#177f78" />
          <stop offset="0.6" stopColor="#0e5e5a" />
          <stop offset="1" stopColor="#06302f" />
        </linearGradient>
      </defs>
      <circle
        cx="56"
        cy="56"
        r="55.5"
        fill={`url(#${id}-rim)`}
        stroke="#000000"
        strokeOpacity="0.18"
      />
      <circle cx="56" cy="56" r="51" fill={`url(#${id}-disc)`} />
      <ClockGlyph transform="translate(11 9.5) scale(3.75)" strokeWidth={1.7} />
    </svg>
  );
}

/** The backup disk, 54 x 57.5 pt: a green drive with the clock glyph on a grey foot. */
export function DiskPicture() {
  const id = useId();
  return (
    <svg width="54" height="57.5" viewBox="0 0 54 57.5" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-foot`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6e8e8" />
          <stop offset="1" stopColor="#a9adad" />
        </linearGradient>
      </defs>
      <path d="M5.5 2h43l4.5 38v14.5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V40z" fill="#0f6d67" />
      <path d="M6.4 3h41.2l4.2 36H2.2z" fill="#1a8a82" />
      <path d="M1 40h52v14.5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" fill={`url(#${id}-foot)`} />
      <circle cx="43" cy="52" r="1.2" fill="#43c463" />
      <ClockGlyph transform="translate(13.2 6.2) scale(1.15)" strokeWidth={2} />
    </svg>
  );
}

/** The glyph of the button that stops a backup: a disc in the text colour with a cross cut out. */
export function StopGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path
        d="M7 0a7 7 0 1 1 0 14A7 7 0 0 1 7 0zM4.9 4 4 4.9 6.1 7 4 9.1l.9.9L7 7.9 9.1 10l.9-.9L7.9 7 10 4.9 9.1 4 7 6.1z"
        fill="currentColor"
        fillRule="evenodd"
        opacity="0.5"
      />
    </svg>
  );
}
