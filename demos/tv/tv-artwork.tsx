import type { ReactNode } from "react";
import type { TvTitle } from "./tv-data";

/*
 * Every picture of the demo is original generated key art for its invented title, one 16:9
 * image per title in art/<id>.webp. None stands for, or is fitted to, a picture of the
 * screenshots, which show third parties' films and series; the comparisons mask every one of
 * them. A title without art gets an abstract placeholder: a muted field in a system colour
 * with one plain figure.
 */

const ART = import.meta.glob<string>("./art/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

const FIELDS = ["indigo", "teal", "orange", "purple", "green", "pink", "blue", "brown"];

const FIGURES: readonly ReactNode[] = [
  <circle key="" cx="80" cy="45" r="20" />,
  <path key="" d="M80 23 103 65H57z" />,
  <path key="" d="M58 27h44v36H58z" />,
  <path key="" d="M56 29h12v32H56zM74 29h12v32H74zM92 29h12v32H92z" />,
];

/** A number from a title's id: the same title always has the same placeholder. */
const seed = (id: string) => [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);

/**
 * The picture of a title, which fills the artwork box of a card or a hero: a 16:9 picture
 * that is cropped to the box.
 */
export function Artwork({ title }: { title: TvTitle }) {
  const art = ART[`./art/${title.id}.webp`];
  if (art) {
    return <img className="mac-tv-artwork" src={art} alt="" aria-hidden="true" draggable={false} />;
  }
  const number = seed(title.id);
  return (
    <svg
      className="mac-tv-artwork"
      viewBox="0 0 160 90"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect
        width="160"
        height="90"
        fill={`var(--mac-color-system-${FIELDS[number % FIELDS.length]})`}
        opacity="0.55"
      />
      <g fill="#ffffff" opacity="0.45">
        {FIGURES[(number >> 3) % FIGURES.length]}
      </g>
    </svg>
  );
}

/** The panes of the Preferences window. */
export type TvPreferencesPane = "general" | "playback" | "files" | "restrictions" | "advanced";

/* Original drawings in the 32 pt box of a preferences toolbar item; none is Apple's icon. */
const PANE_ICONS: Record<TvPreferencesPane, ReactNode> = {
  // A plate with a switch.
  general: (
    <>
      <rect x="6.5" y="3.5" width="19" height="25" rx="2" fill="#f2f2f2" stroke="#a6a6a6" />
      <rect x="13.5" y="10.5" width="5" height="11" rx="1" fill="#d8d8d8" stroke="#8a8a8a" />
    </>
  ),
  // A triangle in a disc.
  playback: (
    <>
      <circle cx="16" cy="16" r="13" fill="#ffffff" stroke="#9a9a9a" />
      <path d="M12.5 10v12l10-6z" fill="#505050" />
    </>
  ),
  // A folder.
  files: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h7l2.5 2.5H27a2 2 0 0 1 2 2V12H3z" fill="#52aee6" />
      <rect x="3" y="10.5" width="26" height="16" rx="2" fill="#79c8f3" />
    </>
  ),
  // A disc with a bar across it.
  restrictions: (
    <>
      <circle cx="16" cy="16" r="12.5" fill="#f5c93a" stroke="#4a4226" strokeWidth="2" />
      <path d="M9 16h14" stroke="#4a4226" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  // A toothed ring.
  advanced: (
    <>
      <circle
        cx="16"
        cy="16"
        r="11.5"
        fill="none"
        stroke="#8c8c8c"
        strokeWidth="4"
        strokeDasharray="5 4.03"
      />
      <circle cx="16" cy="16" r="7" fill="none" stroke="#8c8c8c" strokeWidth="4.5" />
    </>
  ),
};

/** The 32 pt icon of a Preferences toolbar item. */
export function PaneIcon({ pane }: { pane: TvPreferencesPane }) {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
      {PANE_ICONS[pane]}
    </svg>
  );
}
