import { type ReactNode, useId } from "react";

/*
 * Stand-in artwork. Catalina's pane icons are Apple's illustrations and are not reproduced: each
 * pane gets an original drawing of a flat tile or disc with a simple glyph, on the 40 pt canvas
 * the grid allocates. They are decorative; the caption names the pane.
 */

interface Art {
  /** The base: a rounded square, a circle, or nothing. */
  shape: "tile" | "disc" | "none";
  /** Fill of the base. */
  fill: string;
  /** What is drawn on the base, in the 40 x 40 canvas. */
  glyph: ReactNode;
}

const WHITE = "#ffffff";
const INK = "#3a3a3c";

const line = (d: string, stroke = WHITE, width = 2) => (
  <path d={d} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" />
);

const person = (x: number, y: number, scale = 1, fill = WHITE) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} fill={fill}>
    <circle cx="0" cy="-5" r="4" />
    <path d="M-7.5 8a7.5 7 0 0 1 15 0z" />
  </g>
);

const ART: Record<string, Art> = {
  general: {
    shape: "tile",
    fill: "#8f9bab",
    glyph: (
      <>
        <rect x="8" y="9" width="24" height="6" rx="1.5" fill="#3b82f6" />
        {line("M9 20h22M9 25h22M9 30h14")}
      </>
    ),
  },
  "desktop-and-screen-saver": {
    shape: "tile",
    fill: "#4a9df8",
    glyph: (
      <>
        <circle cx="27" cy="13" r="3.5" fill="#ffe08a" />
        <path d="M5 32l9-12 6 7 5-5 10 10z" fill={WHITE} />
      </>
    ),
  },
  dock: {
    shape: "tile",
    fill: "#2c2c2e",
    glyph: (
      <>
        <rect x="7" y="24" width="26" height="8" rx="2.5" fill="#8e8e93" />
        <path d="M10 26h4v4h-4zM16 26h4v4h-4zM22 26h4v4h-4z" fill="#64b5ff" />
      </>
    ),
  },
  "mission-control": {
    shape: "tile",
    fill: "#3a3a3c",
    glyph: (
      <>
        <rect x="7" y="9" width="12" height="9" fill="#ff9f0a" />
        <rect x="21" y="9" width="12" height="9" fill="#64b5ff" />
        <rect x="12" y="21" width="16" height="11" fill="#30d158" />
      </>
    ),
  },
  siri: {
    shape: "disc",
    fill: "#5e3fd6",
    glyph: line("M8 20c3-9 5-9 8 0s5 9 8 0 5-6 8 0", "#f2a7ff", 2.5),
  },
  spotlight: {
    shape: "disc",
    fill: "#1e96f0",
    glyph: (
      <>
        <circle cx="18" cy="18" r="7" fill="none" stroke={WHITE} strokeWidth="2.5" />
        {line("M23.5 23.5l6.5 6.5", WHITE, 3)}
      </>
    ),
  },
  "language-and-region": {
    shape: "tile",
    fill: "#2f7fe0",
    glyph: (
      <>
        <circle cx="20" cy="20" r="11" fill="none" stroke={WHITE} strokeWidth="2" />
        <ellipse cx="20" cy="20" rx="5" ry="11" fill="none" stroke={WHITE} strokeWidth="1.5" />
        {line("M9 20h22", WHITE, 1.5)}
      </>
    ),
  },
  notifications: {
    shape: "tile",
    fill: "#2c2c2e",
    glyph: (
      <>
        <rect x="8" y="12" width="20" height="18" rx="2" fill="#64b5ff" />
        <circle cx="30" cy="11" r="5" fill="#ff453a" />
      </>
    ),
  },
  "internet-accounts": {
    shape: "disc",
    fill: "#1e90f0",
    glyph: (
      <>
        <circle cx="20" cy="20" r="4.5" fill="none" stroke={WHITE} strokeWidth="2.5" />
        {line("M24.5 15.5v6a3 3 0 0 0 6 0v-2a10.5 10.5 0 1 0-4.5 9", WHITE, 2.5)}
      </>
    ),
  },
  "wallet-and-apple-pay": {
    shape: "tile",
    fill: "#e4dfd3",
    glyph: (
      <>
        <rect x="7" y="9" width="26" height="7" rx="2" fill="#ff9f0a" />
        <rect x="7" y="14" width="26" height="7" rx="2" fill="#30b0c7" />
        <rect x="7" y="19" width="26" height="12" rx="2" fill="#34c759" />
      </>
    ),
  },
  "touch-id": {
    shape: "disc",
    fill: "#f7f7f7",
    glyph: line(
      "M12 22a8 8 0 0 1 16 0M16 26v-4a4 4 0 0 1 8 0v6M20 22v9M10 16a12 12 0 0 1 20 0",
      "#f0506e",
      1.8,
    ),
  },
  "users-and-groups": {
    shape: "disc",
    fill: "#6d6d72",
    glyph: (
      <>
        {person(14, 21, 0.9)}
        {person(26, 21, 0.9)}
      </>
    ),
  },
  accessibility: {
    shape: "disc",
    fill: "#1e7df0",
    glyph: (
      <>
        <circle cx="20" cy="11" r="2.6" fill={WHITE} />
        {line("M11 16h18M20 16v8M20 24l-5 8M20 24l5 8", WHITE, 2.4)}
      </>
    ),
  },
  "screen-time": {
    shape: "disc",
    fill: "#5b4bd6",
    glyph: (
      <>
        <path d="M13 9h14l-5 11 5 11H13l5-11z" fill={WHITE} />
        {line("M11 9h18M11 31h18")}
      </>
    ),
  },
  extensions: {
    shape: "tile",
    fill: "#b8bcc2",
    glyph: (
      <path
        d="M9 13h8a3 3 0 1 1 6 0h8v8a3 3 0 1 0 0 6v5H9v-6a3 3 0 1 0 0-6z"
        fill={WHITE}
        opacity="0.9"
      />
    ),
  },
  "security-and-privacy": {
    shape: "none",
    fill: "none",
    glyph: (
      <>
        <path d="M20 4L3 18h4v17h26V18h4z" fill="#8a8d91" />
        <circle cx="20" cy="24" r="7" fill="#d8dadd" stroke={INK} strokeWidth="1.5" />
        <circle cx="20" cy="24" r="2" fill={INK} />
      </>
    ),
  },
  "software-update": {
    shape: "disc",
    fill: "#5a5d63",
    glyph: (
      <>
        <circle
          cx="20"
          cy="20"
          r="10"
          fill="none"
          stroke="#d8dadd"
          strokeWidth="5"
          strokeDasharray="5.2 2.65"
        />
        <circle cx="20" cy="20" r="4" fill="#d8dadd" />
      </>
    ),
  },
  network: {
    shape: "disc",
    fill: "#56679c",
    glyph: (
      <>
        <ellipse cx="20" cy="20" rx="6" ry="13" fill="none" stroke={WHITE} strokeWidth="1.5" />
        {line("M7 20h26M9.5 13h21M9.5 27h21", WHITE, 1.5)}
      </>
    ),
  },
  bluetooth: {
    shape: "none",
    fill: "none",
    glyph: (
      <>
        <rect x="9" y="2" width="22" height="36" rx="10" fill="#1e7df0" />
        {line("M14.5 14.5l11 11-5.5 5.5V9l5.5 5.5-11 11", WHITE, 2)}
      </>
    ),
  },
  sound: {
    shape: "none",
    fill: "none",
    glyph: (
      <>
        <path d="M5 15h7l10-9v28l-10-9H5z" fill="#55585e" />
        {line("M27 14a8.5 8.5 0 0 1 0 12M31 9.5a15 15 0 0 1 0 21", "#8a8d91", 2.5)}
      </>
    ),
  },
  "printers-and-scanners": {
    shape: "none",
    fill: "none",
    glyph: (
      <>
        <rect x="11" y="4" width="18" height="12" fill="#f2f2f4" stroke="#8a8d91" />
        <rect x="4" y="14" width="32" height="14" rx="3" fill="#8a8d91" />
        <rect x="10" y="24" width="20" height="12" fill="#3a3a3c" />
      </>
    ),
  },
  keyboard: {
    shape: "none",
    fill: "none",
    glyph: (
      <>
        <rect x="1" y="11" width="38" height="18" rx="2" fill="#d9dbde" stroke="#a9acb1" />
        <path
          d="M4 14h32M4 18h32M4 22h32"
          stroke="#f8f8f9"
          strokeWidth="2.6"
          strokeDasharray="2.6 1.6"
        />
        {line("M11 26h18", "#f8f8f9", 2.6)}
      </>
    ),
  },
  trackpad: {
    shape: "none",
    fill: "none",
    glyph: <rect x="3" y="7" width="34" height="26" rx="3" fill="#b9bbbf" stroke="#9a9da2" />,
  },
  mouse: {
    shape: "none",
    fill: "none",
    glyph: (
      <>
        <rect x="11" y="2" width="18" height="36" rx="9" fill="#f4f4f6" stroke="#c2c4c8" />
        {line("M20 8v5", "#c2c4c8", 1.5)}
      </>
    ),
  },
  displays: {
    shape: "none",
    fill: "none",
    glyph: (
      <>
        <rect x="1" y="5" width="38" height="25" rx="2" fill="#1b1b1d" />
        <rect x="3" y="7" width="34" height="21" fill="#3d8ef2" />
        <path d="M17 30h6v4h5v2H12v-2h5z" fill="#b9bbbf" />
      </>
    ),
  },
  sidecar: {
    shape: "tile",
    fill: "#1e96f0",
    glyph: (
      <>
        <rect x="7" y="11" width="19" height="14" rx="1.5" fill="none" stroke={WHITE} />
        <rect x="19" y="17" width="14" height="11" rx="1.5" fill="#1e96f0" stroke={WHITE} />
        {line("M10 28h8", WHITE, 1.5)}
      </>
    ),
  },
  "energy-saver": {
    shape: "none",
    fill: "none",
    glyph: (
      <>
        <path d="M20 2a12 12 0 0 1 7 21.7V28H13v-4.3A12 12 0 0 1 20 2z" fill="#ffe9a6" />
        <rect x="14" y="28" width="12" height="8" rx="2" fill="#a9acb1" />
      </>
    ),
  },
  "date-and-time": {
    shape: "disc",
    fill: "#f7f7f7",
    glyph: (
      <>
        <circle cx="20" cy="20" r="17" fill="none" stroke="#a9acb1" strokeWidth="2" />
        {line("M20 20V9M20 20l7 5", INK, 2)}
      </>
    ),
  },
  sharing: {
    shape: "none",
    fill: "none",
    glyph: (
      <>
        <path
          d="M2 9a2 2 0 0 1 2-2h10l3 3h19a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"
          fill="#3a9ff2"
        />
        <path d="M20 14l8 8-8 8-8-8z" fill="#ffd60a" />
      </>
    ),
  },
  "time-machine": {
    shape: "disc",
    fill: "#2c8f7c",
    glyph: (
      <>
        <path d="M10 20a10 10 0 1 0 3-7" fill="none" stroke={WHITE} strokeWidth="2.2" />
        <path d="M9 8v7h7z" fill={WHITE} />
        {line("M20 14v6l4 3")}
      </>
    ),
  },
  "startup-disk": {
    shape: "none",
    fill: "none",
    glyph: (
      <>
        <rect x="5" y="3" width="30" height="34" rx="3" fill="#a9acb1" />
        <circle cx="20" cy="17" r="9" fill="#d9dbde" />
        <circle cx="20" cy="17" r="2" fill="#8a8d91" />
        {line("M10 32h6", "#55585e")}
      </>
    ),
  },
  "apple-id": {
    shape: "tile",
    fill: "#8e8e93",
    glyph: person(20, 21, 1.3),
  },
  "family-sharing": {
    shape: "tile",
    fill: "#f7f7f7",
    glyph: (
      <>
        <circle cx="20" cy="20" r="13" fill="#3a9ff2" />
        {person(14, 22, 0.6)}
        {person(20, 20, 0.75)}
        {person(26, 22, 0.6)}
      </>
    ),
  },
};

const FALLBACK: Art = { shape: "tile", fill: "#a9acb1", glyph: null };

/** The stand-in drawing of a pane, 40 pt square by default. Decorative. */
export function PaneArtwork({ pane, size = 40 }: { pane: string; size?: number }) {
  const art = ART[pane] ?? FALLBACK;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      {art.shape === "tile" ? (
        <rect x="1.5" y="1.5" width="37" height="37" rx="8" fill={art.fill} />
      ) : art.shape === "disc" ? (
        <circle cx="20" cy="20" r="18.5" fill={art.fill} />
      ) : null}
      {art.glyph}
    </svg>
  );
}

/** The stand-in account picture: a neutral silhouette on a disc, in place of a photograph. */
export function AccountPicture({ size = 64 }: { size?: number }) {
  // Of this drawing alone: several windows can be on one page.
  const clip = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <clipPath id={clip}>
        <circle cx="32" cy="32" r="32" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect width="64" height="64" fill="#b8bcc2" />
        <circle cx="32" cy="25" r="12" fill={WHITE} />
        <ellipse cx="32" cy="62" rx="24" ry="20" fill={WHITE} />
      </g>
    </svg>
  );
}
