/*
 * Stand-in picture for the Siri pane: an original drawing in place of Apple's artwork, on the
 * measured 112 x 112 pt box of the orb's rim. It is decorative: the title under it names the
 * pane.
 */

import { useId } from "react";

/** A dark orb in a pale rim, with soft coloured lights crossing at its centre. */
export function OrbPicture() {
  const id = useId();
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d6d6d9" />
        </linearGradient>
        <radialGradient id={`${id}-orb`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#231c66" />
          <stop offset="0.7" stopColor="#0d0b3c" />
          <stop offset="1" stopColor="#05061c" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx="56" cy="56" r="51" />
        </clipPath>
        <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <circle
        cx="56"
        cy="56"
        r="55.5"
        fill={`url(#${id}-rim)`}
        stroke="#000000"
        strokeOpacity="0.18"
      />
      <circle cx="56" cy="56" r="51" fill={`url(#${id}-orb)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <g filter={`url(#${id}-soft)`}>
          <ellipse cx="42" cy="30" rx="22" ry="13" fill="#d6348f" opacity="0.85" />
          <ellipse cx="26" cy="62" rx="15" ry="20" fill="#2a8fe6" opacity="0.8" />
          <ellipse cx="82" cy="62" rx="17" ry="11" fill="#3fd6b4" opacity="0.8" />
          <ellipse cx="62" cy="84" rx="9" ry="17" fill="#c04ad0" opacity="0.75" />
          <ellipse cx="74" cy="34" rx="12" ry="9" fill="#5a48d8" opacity="0.7" />
        </g>
        <path
          d="M56 30c2 14 6 20 22 24-16 4-20 10-22 26-2-16-6-22-22-26 16-4 20-10 22-24z"
          fill="#ffffff"
          opacity="0.85"
          filter={`url(#${id}-soft)`}
        />
        <circle cx="56" cy="55" r="5" fill="#ffffff" opacity="0.9" />
      </g>
    </svg>
  );
}
