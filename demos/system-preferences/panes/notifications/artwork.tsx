/*
 * Stand-in pictures for the Notifications pane: original drawings in place of Apple's
 * application icons and of the miniature Notification Center. Each list icon is a 28 pt shape
 * centred in a 39.5 x 32 pt canvas, which puts the row's text at the measured x 74.
 */

import type { ReactNode } from "react";

/** The applications the pane can list, by id. */
export const APPS = {
  books: "Books",
  calendar: "Calendar",
  facetime: "FaceTime",
  "find-my": "Find My",
  games: "Games",
  home: "Home",
  mail: "Mail",
  maps: "Maps",
  messages: "Messages",
  music: "Music",
} as const;

export type AppId = keyof typeof APPS;

/* Drawn on a 28 x 28 square. */
const ICONS: Record<AppId | "do-not-disturb", ReactNode> = {
  "do-not-disturb": (
    <>
      <rect x="2" y="2" width="24" height="24" rx="3" fill="#34306b" />
      <path d="M17.5 8a7 7 0 1 0 3.6 10.6A6 6 0 0 1 17.5 8z" fill="#ffffff" />
    </>
  ),
  books: (
    <>
      <circle cx="14" cy="14" r="14" fill="#f08a1c" />
      <path d="M13.25 9.5c-2-1.3-4.2-1.6-6.25-1v9.75c2.05-.6 4.25-.3 6.25 1z" fill="#ffffff" />
      <path d="M14.75 9.5c2-1.3 4.2-1.6 6.25-1v9.75c-2.05-.6-4.25-.3-6.25 1z" fill="#ffffff" />
    </>
  ),
  calendar: (
    <>
      <rect x="2" y="2" width="24" height="24" rx="3" fill="#ffffff" stroke="#b9b9bd" />
      <path d="M2 5a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v4H2z" fill="#e9453a" />
      <path
        d="M7 14h3v3H7zM12.5 14h3v3h-3zM18 14h3v3h-3zM7 19.5h3v3H7zM12.5 19.5h3v3h-3z"
        fill="#55555a"
      />
    </>
  ),
  facetime: (
    <>
      <rect x="1" y="4" width="26" height="20" rx="5" fill="#34c85a" />
      <rect x="5" y="9" width="11.5" height="10" rx="2" fill="#ffffff" />
      <path d="M17.5 13l5-3.25v8.5l-5-3.25z" fill="#ffffff" />
    </>
  ),
  "find-my": (
    <>
      <circle cx="14" cy="14" r="14" fill="#3fbf5f" />
      <circle cx="14" cy="14" r="8.5" fill="#d8f5df" />
      <circle cx="14" cy="14" r="3.5" fill="#1f7bf2" stroke="#ffffff" strokeWidth="1.5" />
    </>
  ),
  games: (
    <>
      <circle cx="10" cy="10" r="8" fill="#3d8bf5" />
      <circle cx="19" cy="9.5" r="6.5" fill="#4cd067" />
      <circle cx="20" cy="18" r="6" fill="#f25a8c" />
      <circle cx="11" cy="20" r="5.5" fill="#b455e8" />
      <circle cx="16.5" cy="14" r="4" fill="#f7c531" />
    </>
  ),
  home: (
    <>
      <path d="M14 1.5 27 13h-3v13H4V13H1z" fill="#f39a1e" />
      <path d="M14 8.5 20 14v8H8v-8z" fill="#fbd27a" />
      <path d="M11.5 16h5v6h-5z" fill="#f39a1e" />
    </>
  ),
  mail: (
    <>
      <rect
        x="3"
        y="1"
        width="22"
        height="26"
        rx="2"
        fill="#3d8bf5"
        stroke="#e9eef5"
        strokeWidth="2"
      />
      <rect x="7" y="9" width="14" height="10" rx="1" fill="#ffffff" />
      <path d="M7.5 9.5 14 15l6.5-5.5" fill="none" stroke="#3d8bf5" />
    </>
  ),
  maps: (
    <>
      <rect x="2" y="2" width="24" height="24" rx="5" fill="#e7efd9" />
      <path d="M2 17 26 9v4L2 21zM16 2h4l-6 24h-4z" fill="#f7d774" />
      <path d="M19 6a4 4 0 0 1 4 4c0 3-4 7-4 7s-4-4-4-7a4 4 0 0 1 4-4z" fill="#e9453a" />
      <circle cx="19" cy="10" r="1.5" fill="#ffffff" />
    </>
  ),
  messages: (
    <>
      <path
        d="M14 2c7 0 12.5 4.5 12.5 10.5S21 23 14 23c-1.3 0-2.6-.2-3.8-.5C8.5 24.3 6 25.5 3.5 26c1.3-1.5 2.1-3.200 2.400-5C3.200 19 1.5 16 1.5 12.5 1.5 6.5 7 2 14 2z"
        fill="#3d8bf5"
      />
      <path d="M7.5 11h3v3h-3zM12.5 11h3v3h-3zM17.5 11h3v3h-3z" fill="#ffffff" />
    </>
  ),
  music: (
    <>
      <circle cx="14" cy="14" r="13.5" fill="#ffffff" stroke="#c9c9ce" />
      <path
        d="M12 8.5 20 7v10.5a2.5 2.5 0 1 1-1.5-2.3V10l-5 1v8a2.5 2.5 0 1 1-1.5-2.3z"
        fill="#f24f8e"
      />
    </>
  ),
};

/** The picture of a row of the list. Decorative: the row's title names it. */
export function RowArtwork({ icon }: { icon: AppId | "do-not-disturb" }) {
  return (
    <svg width="39.5" height="32" viewBox="-5.75 -2 39.5 32" aria-hidden="true" focusable="false">
      {ICONS[icon]}
    </svg>
  );
}

/**
 * The miniature Notification Center beside the heading: a panel with a search glyph, the two
 * halves of a tab switch and the Do Not Disturb row with its switch on. It is white in both
 * appearances, as in Catalina. Decorative.
 */
export function NotificationCenterArtwork() {
  return (
    <svg width="100" height="55" viewBox="0 0 100 55" aria-hidden="true" focusable="false">
      <rect
        x="0.5"
        y="0.5"
        width="99"
        height="54"
        rx="2.5"
        fill="#ffffff"
        stroke="#bdbdbf"
        strokeWidth="0.5"
      />
      <path d="M0.75 12h10v42.5H3a2.25 2.25 0 0 1-2.25-2.25z" fill="#f1f1f7" />
      <path
        d="M0.5 12.25h99M10.75 12.25V54.5M10.75 28.25H99.5M10.75 46.25H99.5"
        stroke="#c9c9cc"
        strokeWidth="0.5"
        fill="none"
      />
      <circle cx="75" cy="5.75" r="2.25" fill="none" stroke="#8a8a8e" />
      <path d="M76.75 7.5l2.5 2.5" stroke="#8a8a8e" />
      <path d="M85.5 4h1.5M88.5 4h6M85.5 6.5h1.5M88.5 6.5h6M85.5 9h1.5M88.5 9h6" stroke="#8a8a8e" />
      <rect
        x="15"
        y="16.25"
        width="80"
        height="8"
        rx="1.5"
        fill="none"
        stroke="#c2c2c5"
        strokeWidth="0.5"
      />
      <path d="M55 16.25v8" stroke="#c2c2c5" strokeWidth="0.5" />
      <path d="M21.5 32.5a5 5 0 1 0 3.5 7.5 4.25 4.25 0 0 1-3.5-7.5z" fill="#636266" />
      <rect x="72.25" y="32.5" width="23" height="9.5" rx="4.75" fill="#636266" />
      <circle cx="90.5" cy="37.25" r="4" fill="#ffffff" />
    </svg>
  );
}
