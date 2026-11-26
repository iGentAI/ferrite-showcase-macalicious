/*
 * Stand-in pictures for the Screen Time pane: original drawings in place of Apple's artwork.
 * The pictures of the sections are 24 x 24 pt, those of the apps 26 x 26 pt. All are
 * decorative: the text beside a picture names what it stands for.
 */

import type { CSSProperties, ReactNode } from "react";

function Tile({
  fill,
  style,
  children,
}: {
  fill: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "none", ...style }}
    >
      <rect width="24" height="24" rx="5.5" fill={fill} />
      <g fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

/** The pictures of the sections, by the section's id. Each takes the style that places it. */
export const SECTION_PICTURES: Record<string, (props: { style?: CSSProperties }) => ReactNode> = {
  "app-usage": ({ style }) => (
    <Tile fill="#2f7cf6" style={style}>
      <path d="M12 5.5l7 3.5-7 3.5-7-3.5z" fill="#ffffff" />
      <path d="M5 12.3l7 3.5 7-3.5M5 15.6l7 3.5 7-3.5" />
    </Tile>
  ),
  notifications: ({ style }) => (
    <Tile fill="#ee4a3f" style={style}>
      <path d="M13.5 6.5H8.5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-5" />
      <circle cx="17" cy="7" r="2.2" fill="#ffffff" stroke="none" />
    </Tile>
  ),
  pickups: ({ style }) => (
    <Tile fill="#f2bd0c" style={style}>
      <rect x="13" y="6" width="6" height="12" rx="1.5" />
      <path d="M4.5 14.5c1-2.5 3-3.5 6-3.5M8.3 8.6l2.4 2.4-2.4 2.4" />
    </Tile>
  ),
  downtime: ({ style }) => (
    <Tile fill="#6a5ce0" style={style}>
      <path d="M12 5.5a6.5 6.5 0 1 0 6.5 6.5" />
      <path d="M12 8.5v3.7l2.4 1.6" />
      <path d="M15.5 6.3l.6.3M17.6 8.2l.4.6" />
    </Tile>
  ),
  "app-limits": ({ style }) => (
    <Tile fill="#f28a1c" style={style}>
      <path d="M8 5.5h8M8 18.5h8M9 5.5c0 3.5 2 4.5 3 6.5 1-2 3-3 3-6.5M9 18.5c0-3.5 2-4.5 3-6.5 1 2 3 3 3 6.5" />
    </Tile>
  ),
  "always-allowed": ({ style }) => (
    <Tile fill="#3ab54a" style={style}>
      <path
        d="M12 4.5l2 1.6 2.5-.2.7 2.4 2.1 1.4-1 2.3 1 2.3-2.1 1.4-.7 2.4-2.5-.2-2 1.6-2-1.6-2.5.2-.7-2.4-2.1-1.4 1-2.3-1-2.3 2.1-1.4.7-2.4 2.5.2z"
        fill="#ffffff"
        stroke="none"
      />
      <path d="M8.8 12.2l2.2 2.3 4.2-4.8" stroke="#3ab54a" strokeWidth="1.8" />
    </Tile>
  ),
  "content-and-privacy": ({ style }) => (
    <Tile fill="#ee3b30" style={style}>
      <circle cx="12" cy="12" r="6.2" strokeWidth="1.9" />
      <path d="M7.8 7.8l8.4 8.4" strokeWidth="1.9" />
    </Tile>
  ),
  options: ({ style }) => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "none", ...style }}
    >
      <circle cx="12" cy="12" r="11" fill="#8e8e93" stroke="#c7c7cc" strokeWidth="2" />
      <g fill="#ffffff">
        <circle cx="7.5" cy="12" r="1.4" />
        <circle cx="12" cy="12" r="1.4" />
        <circle cx="16.5" cy="12" r="1.4" />
      </g>
    </svg>
  ),
};

function AppIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "none" }}
    >
      {children}
    </svg>
  );
}

/** The pictures of the apps, by the app's id. */
export const APP_PICTURES: Record<string, () => ReactNode> = {
  all: () => (
    <AppIcon>
      <rect width="26" height="26" rx="6" fill="currentColor" opacity="0.07" />
      <path d="M13 6.5l7 3-7 3-7-3z" fill="#2f8cf0" />
      <path d="M6 13l7 3 7-3" fill="none" stroke="#f2a33a" strokeWidth="1.8" />
      <path d="M6 16.5l7 3 7-3" fill="none" stroke="#ee5d8a" strokeWidth="1.8" />
    </AppIcon>
  ),
  finder: () => (
    <AppIcon>
      <rect x="2" y="3" width="22" height="20" rx="3" fill="#49b3f5" />
      <path
        d="M13 3h8a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3h-9c1.5-6 0-9 0-11 0-4 .5-6 1-9z"
        fill="#e6f1fa"
      />
      <path
        d="M8 9v2.5M18 9v2.5M7 16.5c3.5 2.5 8.5 2.5 12 0"
        fill="none"
        stroke="#1d3f66"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </AppIcon>
  ),
  safari: () => (
    <AppIcon>
      <circle cx="13" cy="13" r="11.5" fill="#f1f1f3" stroke="#c9c9ce" />
      <circle cx="13" cy="13" r="9.5" fill="#2b8ef0" />
      <path d="M18.5 7.5l-4 7-3-3z" fill="#f04a3e" />
      <path d="M7.5 18.5l4-7 3 3z" fill="#ffffff" />
    </AppIcon>
  ),
  "system-preferences": () => (
    <AppIcon>
      <rect x="2" y="2" width="22" height="22" rx="3" fill="#55585c" stroke="#8d9095" />
      <circle
        cx="13"
        cy="13"
        r="7"
        fill="none"
        stroke="#c9ccd0"
        strokeWidth="3"
        strokeDasharray="2.4 1.26"
      />
      <circle cx="13" cy="13" r="5" fill="#3a3c3f" stroke="#c9ccd0" strokeWidth="1.6" />
      <path d="M13 13V8.5M13 13l3.9 2.3M13 13l-3.9 2.3" stroke="#c9ccd0" strokeWidth="1.3" />
    </AppIcon>
  ),
  "system-information": () => (
    <AppIcon>
      <rect x="8" y="15" width="10" height="8" rx="1" fill="#3d3f42" />
      <path d="M10 23v2M13 23v2M16 23v2" stroke="#8d9095" strokeWidth="1.2" />
      <path d="M13 4l-7 12M13 4l7 12" fill="none" stroke="#9a9da2" strokeWidth="1.5" />
      <circle cx="13" cy="4.5" r="2.2" fill="#d5d7da" stroke="#8d9095" />
    </AppIcon>
  ),
  textedit: () => (
    <AppIcon>
      <path d="M6 2h13l3 22H3z" fill="#f7f7f5" stroke="#c5c5c2" />
      <path d="M8 7h9M7.6 11h10M7.2 15h11M6.8 19h9" stroke="#b9bcc2" strokeWidth="1.1" />
    </AppIcon>
  ),
};

/** A chevron for the buttons that step a day back and forward, in the text colour. */
export function Chevron({ forward = false }: { forward?: boolean }) {
  return (
    <svg
      width="7"
      height="12"
      viewBox="0 0 7 12"
      aria-hidden="true"
      focusable="false"
      style={forward ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M6 1L1 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
