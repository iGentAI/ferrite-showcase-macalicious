import { type ReactNode, useId } from "react";

/*
 * Stand-ins for the pane's pictures: original drawings in place of the account's photograph,
 * of Apple's tiles for the pages of an account, of the picture of the Mac and of the icons of
 * the nine apps. All are decorative: the text beside each names it.
 */

/** The account's picture, 98 pt across: a grey disc with a head and shoulders. */
export function AccountPicture() {
  const clip = useId();
  return (
    <svg width="98" height="98" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <clipPath id={clip}>
        <circle cx="32" cy="32" r="32" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect width="64" height="64" fill="#b8bcc2" />
        <circle cx="32" cy="25" r="12" fill="#ffffff" />
        <ellipse cx="32" cy="62" rx="24" ry="20" fill="#ffffff" />
      </g>
    </svg>
  );
}

/** The pages of the sidebar that have a tile, and the Mac under them. */
export type PageIcon =
  | "overview"
  | "name-phone-email"
  | "password-security"
  | "payment-shipping"
  | "icloud"
  | "media-purchases"
  | "device";

const CLOUD = "M7.5 16a3.5 3.5 0 0 1 .4-6.98 4.5 4.5 0 0 1 8.6 1.18A2.9 2.9 0 0 1 16 16z";

/** The white glyph of a grey tile, on its 23 pt square. */
const GLYPHS: Record<Exclude<PageIcon, "icloud" | "media-purchases" | "device">, ReactNode> = {
  overview: (
    <>
      <circle cx="11.5" cy="8.5" r="3.2" />
      <path d="M5 18.5a6.5 6.5 0 0 1 13 0z" />
    </>
  ),
  "name-phone-email": (
    <path d="M7.2 5.5l2.3-.8 1.6 3.6-1.5 1.2c.8 1.7 2 2.9 3.7 3.7l1.2-1.5 3.6 1.6-.8 2.3c-.3.9-1.1 1.3-2 1.1-5-1.2-8-4.2-9.2-9.2-.2-.9.2-1.7 1.1-2z" />
  ),
  "password-security": (
    <>
      <rect x="6.5" y="10.5" width="10" height="8" rx="1.5" />
      <path d="M8.5 10.5V8a3 3 0 0 1 6 0v2.5" fill="none" stroke="#ffffff" strokeWidth="1.5" />
    </>
  ),
  "payment-shipping": (
    <path
      d="M6 6.5h11A1.5 1.5 0 0 1 18.5 8v7a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 15V8A1.5 1.5 0 0 1 6 6.5zM4.5 9v2h14V9zM6.5 13v1.5h4V13z"
      fillRule="evenodd"
    />
  ),
};

/**
 * The picture before a page of the sidebar: a 23 pt tile in a box 27.25 pt wide, which puts
 * the page's name where Catalina's is. The box is taller than the tile, which is at its top:
 * a row centres its picture, and Catalina's tiles sit 0.75 pt above the middle of their rows
 * (2 pt in the row with two lines of disabled text). `dimmed` draws the tile at half strength,
 * for a page that is not available.
 */
export function PageArtwork({ icon, dimmed = false }: { icon: PageIcon; dimmed?: boolean }) {
  const fill = useId();
  if (icon === "device") {
    // A notebook computer seen from the front, 21 x 13.5 pt.
    return (
      <svg width="27.25" height="15" viewBox="-1 0 27.25 15" aria-hidden="true" focusable="false">
        <rect x="2.5" width="16" height="11" rx="1" fill="#2b2b2e" />
        <rect x="3.5" y="1" width="14" height="9" fill="#c9824a" />
        <path d="M3.5 10l5-4 3 2 3-3 3 3v2z" fill="#7a3f2a" />
        <path d="M0 11.5h21l-1 2H1z" fill="#b9babd" />
      </svg>
    );
  }
  const [top, bottom] =
    icon === "icloud"
      ? ["#ffffff", "#f2f2f2"]
      : icon === "media-purchases"
        ? ["#3aa8f5", "#1b6fe0"]
        : ["#a6a6aa", "#7c7c80"];
  const height = dimmed ? 27 : 24.5;
  return (
    <svg
      width="27.25"
      height={height}
      viewBox={`0 0 27.25 ${height}`}
      aria-hidden="true"
      focusable="false"
      opacity={dimmed ? 0.5 : undefined}
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect x="0.25" y="0.25" width="22.5" height="22.5" rx="5" fill={`url(#${fill})`} />
      {icon === "icloud" ? (
        <>
          <rect
            x="0.25"
            y="0.25"
            width="22.5"
            height="22.5"
            rx="5"
            fill="none"
            stroke="#d0d0d0"
            strokeWidth="0.5"
          />
          <path d={CLOUD} fill="#2f9bf4" />
        </>
      ) : icon === "media-purchases" ? (
        <path
          d="M11.5 5.5l-5 11M11.5 5.5l5 11M7 13h9"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ) : (
        <g fill="#ffffff">{GLYPHS[icon]}</g>
      )}
    </svg>
  );
}

/** The apps of the list, by id. */
export type AppIcon =
  | "icloud-drive"
  | "photos"
  | "mail"
  | "contacts"
  | "calendars"
  | "reminders"
  | "safari"
  | "notes"
  | "siri";

const PETALS = [
  "#f6b73c",
  "#f08a3c",
  "#e8504f",
  "#c45ac8",
  "#6a6fe0",
  "#3fa3f0",
  "#49c46a",
  "#b6d443",
];

const APPS: Record<AppIcon, ReactNode> = {
  "icloud-drive": (
    <path d="M8 26a7 7 0 0 1-.6-13.97A9.5 9.5 0 0 1 25.6 14.2 6 6 0 0 1 25 26z" fill="#3fa9f5" />
  ),
  photos: (
    <>
      <circle cx="16" cy="16" r="14.5" fill="#ffffff" stroke="#d6d6d6" />
      {PETALS.map((color, index) => (
        <ellipse
          key={color}
          cx="16"
          cy="9"
          rx="3.4"
          ry="5.6"
          fill={color}
          opacity="0.85"
          transform={`rotate(${index * 45} 16 16)`}
        />
      ))}
    </>
  ),
  mail: (
    <>
      <rect x="3" y="2" width="26" height="28" rx="1.5" fill="#ffffff" stroke="#c9d3dc" />
      <rect x="5.5" y="4.5" width="21" height="23" fill="#4a9be8" />
      <path d="M8 21l6-8 5 5 3-3 4 6z" fill="#ffffff" opacity="0.9" />
    </>
  ),
  contacts: (
    <>
      <rect x="4" y="1.5" width="23" height="29" rx="2" fill="#a97b4f" />
      <path d="M27 6h2v5h-2zM27 13h2v5h-2zM27 20h2v5h-2z" fill="#d9b36a" />
      <circle cx="15.5" cy="13" r="4" fill="#8a6238" />
      <path d="M8.5 24a7 7 0 0 1 14 0z" fill="#8a6238" />
    </>
  ),
  calendars: (
    <>
      <rect x="3" y="2.5" width="26" height="27" rx="2" fill="#ffffff" stroke="#cfcfcf" />
      <path d="M3 4.5a2 2 0 0 1 2-2h22a2 2 0 0 1 2 2V10H3z" fill="#e8504f" />
      <path d="M11 15l2.5-1.5V26M17 14.5h6L19 26" fill="none" stroke="#333333" strokeWidth="1.8" />
    </>
  ),
  reminders: (
    <>
      <rect x="4" y="1.5" width="24" height="29" rx="2.5" fill="#ffffff" stroke="#cfcfcf" />
      <circle cx="9" cy="8" r="1.8" fill="#3f8fe8" />
      <circle cx="9" cy="14" r="1.8" fill="#e8504f" />
      <circle cx="9" cy="20" r="1.8" fill="#f08a3c" />
      <path d="M13 8h11M13 14h11M13 20h11M13 26h11" stroke="#d6d6d6" />
    </>
  ),
  safari: (
    <>
      <circle cx="16" cy="16" r="14.5" fill="#ffffff" stroke="#d6d6d6" />
      <circle cx="16" cy="16" r="12.5" fill="#2f8fe8" />
      <path d="M23.5 8.5l-5.6 9.4-3.8-3.800z" fill="#e8504f" />
      <path d="M8.5 23.5l5.6-9.4 3.800 3.800z" fill="#ffffff" />
    </>
  ),
  notes: (
    <>
      <rect x="4" y="2" width="24" height="28" rx="1.5" fill="#fdfdf6" stroke="#d6d3c4" />
      <path d="M4 3.5a1.5 1.5 0 0 1 1.5-1.5h21A1.5 1.5 0 0 1 28 3.5V8H4z" fill="#f7d154" />
      <path d="M7 13h18M7 17h18M7 21h18M7 25h18" stroke="#dedbcc" />
    </>
  ),
  siri: (
    <>
      <circle cx="16" cy="16" r="14.5" fill="#17172b" stroke="#c9c9d6" />
      <path d="M5 17c4-7 7-7 11 0s7 6 11-2" fill="none" stroke="#5ad1f5" strokeWidth="2.5" />
      <path
        d="M5 15c4 6 8 6 11 0s7-6 11 1"
        fill="none"
        stroke="#e85ac4"
        strokeWidth="2"
        opacity="0.85"
      />
    </>
  ),
};

/** The picture of an app of the list, on a 32 pt square. */
export function AppArtwork({ icon }: { icon: AppIcon }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {APPS[icon]}
    </svg>
  );
}
