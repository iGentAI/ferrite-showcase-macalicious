/*
 * Stand-in picture for the Printers & Scanners pane: an original drawing of a laser printer in
 * place of the manufacturer's photograph, on the measured boxes (93 x 64 pt in the detail box,
 * 33 x 25 pt in the list). It is decorative: the text beside it names the printer.
 */

import type { CSSProperties } from "react";

/** A dark laser printer seen from the front: output slot on top, paper tray below. */
export function PrinterPicture({
  width,
  height,
  style,
}: {
  width: number;
  height: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 93 64"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path d="M16 3h61l12 15H4z" fill="#4b4b4f" />
      <path d="M22 7h49l6 8H16z" fill="#222225" />
      <path d="M4 18h85v37a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#38383b" />
      <path d="M4 18h85v4H4z" fill="#434346" />
      <rect x="13" y="36" width="67" height="12" rx="2" fill="#2a2a2d" />
      <rect x="30" y="40" width="33" height="3" rx="1.5" fill="#1b1b1d" />
      <rect x="70" y="26" width="11" height="3" rx="1.5" fill="#5b5b60" />
      <path d="M10 59h10v3H10zM73 59h10v3H73z" fill="#242426" />
    </svg>
  );
}
