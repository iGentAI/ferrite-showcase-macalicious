import type { ReactNode } from "react";
import type { MusicCover, MusicSection } from "./music-data";

/*
 * Every drawing here is original stand-in artwork. Catalina's album covers, sidebar icons and
 * preference-pane icons are Apple's or their licensors' and are not reproduced.
 */

/** The generated covers in ./art, by the id of the album they belong to. */
const COVERS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./art/*.webp", { eager: true, query: "?url", import: "default" }),
  ).map(([file, url]) => [file.slice("./art/".length, -".webp".length), url]),
);

const MOTIFS: Record<MusicCover["motif"], ReactNode> = {
  rings: (
    <g fill="none" stroke="currentColor" strokeWidth="6">
      <circle cx="84" cy="84" r="22" />
      <circle cx="84" cy="84" r="44" />
      <circle cx="84" cy="84" r="66" />
    </g>
  ),
  bars: (
    <path
      fill="currentColor"
      d="M28 96h14v44H28zM52 64h14v76H52zM76 40h14v100H76zM100 76h14v64h-14zM124 104h14v36h-14z"
    />
  ),
  hill: <path fill="currentColor" d="M0 168v-52q42-44 84-12t84-20v84z" />,
  grid: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      d="M42 0v168M84 0v168M126 0v168M0 42h168M0 84h168M0 126h168"
    />
  ),
  wave: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="7"
      d="M-8 70q22-24 44 0t44 0 44 0 44 0 44 0M-8 100q22-24 44 0t44 0 44 0 44 0 44 0M-8 130q22-24 44 0t44 0 44 0 44 0 44 0"
    />
  ),
  sun: (
    <>
      <circle cx="84" cy="92" r="36" fill="currentColor" />
      <path fill="currentColor" d="M0 128h168v6H0zM0 142h168v5H0zM0 155h168v4H0z" />
    </>
  ),
};

/**
 * The cover of an album: its generated artwork when there is one for `id`, otherwise a flat
 * ground with a simple motif. It fills the box it is put in and is decorative; the album is
 * named by the text beside it.
 */
export function AlbumCover({ id, cover, src }: { id?: string; cover: MusicCover; src?: string }) {
  const url = src ?? (id ? COVERS[id] : undefined);
  if (url) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 168 168"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: "block", color: cover.ink }}
      aria-hidden="true"
    >
      <rect width="168" height="168" fill={cover.ground} />
      {MOTIFS[cover.motif]}
    </svg>
  );
}

const WHITE = "#ffffff";

/** Fill of the rounded square and the white glyph on it, on an 18 pt grid. */
const SECTION_ICONS: Record<MusicSection, [fill: string, glyph: ReactNode]> = {
  "for-you": [
    "#ff5c75",
    <path
      key=""
      fill={WHITE}
      d="M9 14.2 4.3 9.5a2.9 2.9 0 0 1 4.1-4.1l.6.6.6-.6a2.9 2.9 0 0 1 4.1 4.1z"
    />,
  ],
  browse: [
    "#fb4372",
    <path
      key=""
      fill={WHITE}
      d="M7 4.6 13 3.4v7.4a1.9 1.6 0 1 1-1-1.4V5.7L8 6.5v5.9a1.9 1.6 0 1 1-1-1.4z"
    />,
  ],
  radio: [
    "#f743a8",
    <g key="" fill="none" stroke={WHITE} strokeWidth="1.1" strokeLinecap="round">
      <circle cx="9" cy="9" r="1.4" fill={WHITE} stroke="none" />
      <path d="M6.5 6.5a3.6 3.6 0 0 0 0 5M11.5 6.5a3.6 3.6 0 0 1 0 5M4.7 4.7a6.1 6.1 0 0 0 0 8.6M13.3 4.7a6.1 6.1 0 0 1 0 8.6" />
    </g>,
  ],
  "recently-added": [
    "#b950f2",
    <g key="">
      <circle cx="9" cy="9" r="5.2" fill={WHITE} />
      <path
        d="M9 5.8V9l2.2 1.3"
        fill="none"
        stroke="#b950f2"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </g>,
  ],
  artists: [
    "#a352f3",
    <g key="">
      <circle cx="11.3" cy="6.7" r="2.7" fill={WHITE} />
      <path d="M9.6 8.4 5 13.6" stroke={WHITE} strokeWidth="1.9" strokeLinecap="round" />
    </g>,
  ],
  albums: [
    "#7f6bf3",
    <g key="" fill={WHITE}>
      <path d="M7.5 5.2 13.2 4a.6.6 0 0 1 .8.6v8.8a.6.6 0 0 1-.8.6l-5.7-1.2z" />
      <path d="M5.6 5.6h.9v6.8h-.9zM3.9 6.2h.8v5.6h-.8z" opacity="0.75" />
    </g>,
  ],
  songs: [
    "#6e80f4",
    <path key="" fill={WHITE} d="M8.4 3.6h4.4v2.2h-3.2v6.3a2.1 1.8 0 1 1-1.2-1.6z" />,
  ],
  "itunes-store": [
    "#e63de0",
    <path
      key=""
      fill={WHITE}
      d="m9 3.8 1.29 3.42 3.66.17-2.86 2.29.97 3.53L9 11.2l-3.06 2.01.97-3.53-2.86-2.29 3.66-.17z"
    />,
  ],
};

/** The icon of a sidebar row: an 18 pt coloured rounded square with a white glyph. */
export function SectionIcon({ section }: { section: MusicSection }) {
  const [fill, glyph] = SECTION_ICONS[section];
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <rect width="18" height="18" rx="4.5" fill={fill} />
      {glyph}
    </svg>
  );
}

/** The panes of the Preferences window. */
export type MusicPreferencesPane = "general" | "playback" | "files" | "restrictions" | "advanced";

const PANE_ICONS: Record<MusicPreferencesPane, ReactNode> = {
  // A wall plate with a rocker switch.
  general: (
    <>
      <rect x="5.5" y="2.5" width="21" height="27" rx="2.5" fill="#f4f4f4" stroke="#a9a9a9" />
      <rect x="12.5" y="9.5" width="7" height="13" rx="1" fill="#dcdcdc" stroke="#8e8e8e" />
      <path d="M13 16h6" stroke="#8e8e8e" />
    </>
  ),
  // A play triangle in a white disc.
  playback: (
    <>
      <circle cx="16" cy="16" r="13.5" fill="#ffffff" stroke="#9d9d9d" />
      <path d="M12 9.5v13l11-6.5z" fill="#4d4d4d" />
    </>
  ),
  // A folder.
  files: (
    <>
      <path d="M2.5 7a2 2 0 0 1 2-2h7l3 3h13a2 2 0 0 1 2 2v2h-27z" fill="#4aa9e8" />
      <rect x="2.5" y="10" width="27" height="17" rx="2" fill="#72c6f5" />
    </>
  ),
  // Two figures in a yellow disc.
  restrictions: (
    <>
      <circle cx="16" cy="16" r="13" fill="#f7c832" stroke="#3a3421" strokeWidth="2" />
      <circle cx="13" cy="9.5" r="2.2" fill="#2c2817" />
      <path d="M10 13h6v7h-1.4v5h-3.2v-5H10z" fill="#2c2817" />
      <circle cx="20.5" cy="15.5" r="1.6" fill="#2c2817" />
      <path d="M18.5 18h4v4h-.9v3h-2.2v-3h-.9z" fill="#2c2817" />
    </>
  ),
  // A gear: a toothed ring.
  advanced: (
    <>
      <circle
        cx="16"
        cy="16"
        r="11.5"
        fill="none"
        stroke="#8f8f8f"
        strokeWidth="4"
        strokeDasharray="4.5 4.53"
      />
      <circle cx="16" cy="16" r="7.5" fill="none" stroke="#8f8f8f" strokeWidth="5" />
      <circle cx="16" cy="16" r="3" fill="#b9b9b9" />
    </>
  ),
};

/** The 32 pt icon of a Preferences toolbar item. */
export function PaneIcon({ pane }: { pane: MusicPreferencesPane }) {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
      {PANE_ICONS[pane]}
    </svg>
  );
}
