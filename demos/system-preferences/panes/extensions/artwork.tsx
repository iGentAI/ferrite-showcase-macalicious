/*
 * Stand-in pictures for the Extensions pane: original drawings in place of the icons of the
 * nine share extensions, each on the 24 x 24 pt canvas of a row of the list.
 */

import type { ReactNode } from "react";

export type ShareIcon =
  | "reading-list"
  | "mail"
  | "messages"
  | "airdrop"
  | "notes"
  | "photos"
  | "people"
  | "reminders"
  | "books";

const PETALS = [
  "#f5a623",
  "#f8d648",
  "#7ed321",
  "#35c2a8",
  "#4a90e2",
  "#7b61d9",
  "#d05ccb",
  "#e9453a",
];

const ICONS: Record<ShareIcon, ReactNode> = {
  // A pair of glasses, in the colour of the text beside it.
  "reading-list": (
    <g fill="none" stroke="currentColor" strokeWidth="1.2">
      <circle cx="6" cy="12.5" r="4.5" />
      <circle cx="18" cy="12.5" r="4.5" />
      <path d="M10.5 12c1-.9 2-.9 3 0M1.5 12.2l-1-2.2M22.5 12.2l1-2.2" />
    </g>
  ),
  mail: (
    <>
      <rect x="3" y="1" width="19" height="22" rx="1.5" fill="#f4f6fa" stroke="#b9c0cc" />
      <rect x="5.5" y="3.5" width="14" height="17" fill="#4a8fe8" />
      <path d="M5.5 15l5-5 3.5 3.5 2.5-2 3 3v6h-14z" fill="#2f63b5" />
      <circle cx="15.5" cy="7.5" r="1.8" fill="#fbe7a1" />
    </>
  ),
  messages: (
    <>
      <ellipse cx="9.5" cy="9.5" rx="8.5" ry="7" fill="#3d9bf5" />
      <path d="M3 14l-1.5 4.5 5.5-2.5z" fill="#3d9bf5" />
      <ellipse cx="16" cy="16" rx="7" ry="5.5" fill="#e9eef5" stroke="#aeb7c4" strokeWidth="0.5" />
      <path d="M20 20l2.5 3-5.5-1.5z" fill="#e9eef5" />
    </>
  ),
  airdrop: (
    <>
      <circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#3a8df0" strokeWidth="1.2" />
      <g fill="none" stroke="#3a8df0" strokeWidth="1.3">
        <path d="M5.2 17.5a8.5 8.5 0 1 1 13.6 0" />
        <path d="M7.8 15.8a5.3 5.3 0 1 1 8.4 0" />
      </g>
      <path d="M12 11l3.5 8h-7z" fill="#3a8df0" />
    </>
  ),
  notes: (
    <>
      <rect x="3" y="1" width="18" height="22" rx="2" fill="#fdfdf6" stroke="#c9c5ad" />
      <path d="M3.5 3A1.5 1.5 0 0 1 5 1.5h14A1.5 1.5 0 0 1 20.5 3v4h-17z" fill="#f8d648" />
      <path d="M6 11h12M6 14.5h12M6 18h8" stroke="#c9c5ad" />
    </>
  ),
  photos: (
    <>
      <circle cx="12" cy="12" r="11.5" fill="#ffffff" stroke="#d5d5d8" strokeWidth="0.5" />
      {PETALS.map((fill, index) => (
        <ellipse
          key={fill}
          cx="12"
          cy="6.5"
          rx="2.6"
          ry="4.2"
          fill={fill}
          fillOpacity="0.85"
          transform={`rotate(${index * 45} 12 12)`}
        />
      ))}
    </>
  ),
  people: (
    <>
      <rect x="2" y="1.5" width="20" height="21" rx="2.5" fill="#3f8fe6" />
      <circle cx="12" cy="9" r="4" fill="#ffffff" />
      <path d="M4.5 22.5C5 17.5 8 15 12 15s7 2.5 7.5 7.5z" fill="#ffffff" />
      <circle cx="5" cy="18.5" r="4.5" fill="#2f63b5" stroke="#ffffff" />
      <path d="M5 16.2v4.6M2.7 18.5h4.6" stroke="#ffffff" strokeWidth="1.2" />
    </>
  ),
  reminders: (
    <>
      <rect x="3" y="1" width="18" height="22" rx="2" fill="#ffffff" stroke="#c2c2c7" />
      <circle cx="7.5" cy="6.5" r="1.6" fill="#e9453a" />
      <circle cx="7.5" cy="12" r="1.6" fill="#f5a623" />
      <circle cx="7.5" cy="17.5" r="1.6" fill="#4a90e2" />
      <path d="M11 6.5h7M11 12h7M11 17.5h7" stroke="#8e8e93" />
    </>
  ),
  books: (
    <>
      <circle cx="12" cy="12" r="10.5" fill="#f08a1c" />
      <path d="M11.4 8.2C9.7 7.1 7.8 6.8 6 7.3v8.4c1.8-.5 3.7-.2 5.4.9z" fill="#ffffff" />
      <path d="M12.6 8.2c1.7-1.1 3.6-1.4 5.4-.9v8.4c-1.8-.5-3.7-.2-5.4.9z" fill="#ffffff" />
    </>
  ),
};

/** The picture of a share extension. Decorative: the row's title names it. */
export function ShareArtwork({ icon }: { icon: ShareIcon }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      // The canvas starts at the column's edge and is centred in the 32 pt row.
      style={{ display: "block", margin: "4px 0 0 -3px" }}
    >
      {ICONS[icon]}
    </svg>
  );
}
