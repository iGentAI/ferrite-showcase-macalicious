/*
 * Stand-in pictures for the services of the Network pane: original drawings on a 32 x 32 pt
 * box at the trailing edge of a service row, in place of Apple's artwork. Each is decorative:
 * the row's title names the service. The box reaches 5 pt into the row's trailing padding and
 * starts where the row's own gap would be, as the captured pictures do (x 151 to 183).
 */

import type { ReactNode } from "react";

function Picture({ children }: { children: ReactNode }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      style={{ margin: "0 -5px 0 -6px" }}
    >
      {children}
    </svg>
  );
}

/** Wi-Fi: a fan of three arcs over a dot. */
export function WiFiPicture() {
  return (
    <Picture>
      <g fill="none" stroke="#2f9bf0" strokeWidth="2.6">
        <path d="M1.4 12.4a20.6 20.6 0 0 1 29.2 0" />
        <path d="M6 17a14.2 14.2 0 0 1 20 0" />
        <path d="M10.3 21.3a8 8 0 0 1 11.4 0" />
      </g>
      <path d="M16 27.5l-3.1-3.2a4.4 4.4 0 0 1 6.2 0z" fill="#1f7fe0" />
    </Picture>
  );
}

/** A personal area network: two joined nodes on a blue lozenge. */
export function PersonalAreaNetworkPicture() {
  return (
    <Picture>
      <rect x="6" y="1" width="21" height="30" rx="9.5" ry="12" fill="#1c84e8" />
      <path d="M12.5 10.5l8 11" stroke="#ffffff" strokeWidth="1.6" />
      <circle cx="12.5" cy="10.5" r="2.6" fill="#ffffff" />
      <circle cx="20.5" cy="21.5" r="2.6" fill="#ffffff" />
    </Picture>
  );
}

/** A wired port: two angle brackets around three dots. */
export function WiredPicture() {
  return (
    <Picture>
      <path
        d="M9 7L1.6 16.3 9 25.6M23 7l7.4 9.3L23 25.6"
        fill="none"
        stroke="#8f9aab"
        strokeWidth="1.4"
      />
      <g fill="#a7b0be">
        <circle cx="11.6" cy="16.3" r="1.7" />
        <circle cx="16" cy="16.3" r="1.7" />
        <circle cx="20.4" cy="16.3" r="1.7" />
      </g>
    </Picture>
  );
}
