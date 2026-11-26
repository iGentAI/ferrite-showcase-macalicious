import { useId } from "react";

/*
 * Stand-ins for the pictures of the Bluetooth pane: original drawings, no Apple artwork and not
 * the Bluetooth mark.
 */

/**
 * The picture above the status, on the 106.5 x 144.5 pt box of Catalina's emblem: a tall blue
 * plaque with a white sign of radio waves. The same in both appearances. Decorative.
 */
export function BluetoothArtwork() {
  const fill = useId();
  return (
    <svg
      width="106.5"
      height="144.5"
      viewBox="0 0 106.5 144.5"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#19b4ff" />
          <stop offset="1" stopColor="#0a67ff" />
        </linearGradient>
      </defs>
      <path
        d="M53.25 1C84 1 105 27 105 71s-21 71-51.75 71S1.5 115 1.5 71 22.5 1 53.25 1z"
        fill={`url(#${fill})`}
      />
      <g fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round">
        <path d="M40 58a19 19 0 0 1 0 28" />
        <path d="M51 45a36 36 0 0 1 0 54" />
        <path d="M62 33a52 52 0 0 1 0 78" />
      </g>
      <circle cx="29" cy="72" r="5.5" fill="#ffffff" />
    </svg>
  );
}

/** A device's thumbnail in the list: a pale mouse seen from above, 17 x 30 pt. Decorative. */
export function MouseArtwork() {
  return (
    <svg width="17" height="30" viewBox="0 0 17 30" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="16" height="28" rx="7.5" fill="#f7f7f7" stroke="#c9c9c9" />
      <circle cx="8.5" cy="22.5" r="1.1" fill="#d6d6d6" />
    </svg>
  );
}
