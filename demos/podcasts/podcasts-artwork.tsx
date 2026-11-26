import type { CSSProperties, ReactNode } from "react";
import type { PodcastsColor, PodcastsSection } from "./podcasts-data";

/*
 * Stand-in drawings. Podcasts' artwork is Apple's and the shows' own; none of it is
 * reproduced. Everything here is an original drawing in the box the capture measures.
 */

/** The generated show artwork in ./art, by the id of the show it belongs to. */
const ARTWORK: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./art/*.webp", { eager: true, query: "?url", import: "default" }),
  ).map(([file, url]) => [file.slice("./art/".length, -".webp".length), url]),
);

const FILL: CSSProperties = { display: "grid", placeItems: "center" };

/* Paint from the demo's tokens. In `style`, since a custom property there is resolved like
   any other declaration. */
const fill = (token: string): CSSProperties => ({ fill: `var(--mac-podcasts-${token})` });
const MARK = fill("artwork-mark");
const MARK_LINE: CSSProperties = { stroke: "var(--mac-podcasts-artwork-mark)" };
const GLYPH: CSSProperties = { ...fill("icon-glyph"), color: "var(--mac-podcasts-icon-glyph)" };
const PANE_FILL = fill("pane-icon-fill");
const PANE_MARK = fill("pane-icon-mark");

export interface ShowArtworkProps {
  /** The show's id: its generated artwork is shown when there is one. */
  id?: string;
  /** The two system colours of the show's cover. */
  colors: readonly [PodcastsColor, PodcastsColor];
  /**
   * The address of the show's own cover, loaded by the browser over the gradient: the Ferrite
   * desktop's real shows have one.
   */
  src?: string;
}

const COVER: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

/**
 * A show's cover: its generated artwork, or else a gradient between its two colours with a broadcast mark. It fills the box
 * it is placed in (a card's artwork box, the display's well). Decorative: the card names the
 * show in text.
 */
export function ShowArtwork({ id, colors, src }: ShowArtworkProps) {
  const url = id ? ARTWORK[id] : undefined;
  if (src) {
    return (
      <span
        className="mac-podcasts-artwork"
        aria-hidden="true"
        style={{
          ...FILL,
          background: `linear-gradient(135deg, var(--mac-color-system-${colors[0]}), var(--mac-color-system-${colors[1]}))`,
        }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          style={COVER}
        />
      </span>
    );
  }
  if (url) {
    return (
      <span className="mac-podcasts-artwork" aria-hidden="true" style={FILL}>
        <img
          src={url}
          alt=""
          draggable={false}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
    );
  }
  return (
    <span
      className="mac-podcasts-artwork"
      aria-hidden="true"
      style={{
        ...FILL,
        background: `linear-gradient(135deg, var(--mac-color-system-${colors[0]}), var(--mac-color-system-${colors[1]}))`,
      }}
    >
      <svg viewBox="0 0 24 24" width="46%" height="46%" fill="none" aria-hidden="true">
        <g style={MARK_LINE} strokeWidth="1.6" strokeLinecap="round">
          <path d="M7.4 14.6a6.5 6.5 0 1 1 9.2 0M4.6 17.4a10.4 10.4 0 1 1 14.8 0" />
          <path d="M12 13.5v7" strokeWidth="2.4" />
        </g>
        <circle cx="12" cy="10" r="2.2" style={MARK} />
      </svg>
    </span>
  );
}

/* White glyphs on an 18 pt rounded square, one per sidebar row. */
const SECTION_GLYPHS: Record<PodcastsSection, ReactNode> = {
  "listen-now": (
    <>
      <circle cx="9" cy="9" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.6 6.3 11.7 9l-4.1 2.7z" />
    </>
  ),
  browse: <path d="M4 4h4.2v4.2H4zM9.8 4H14v4.2H9.8zM4 9.8h4.2V14H4zM9.8 9.8H14V14H9.8z" />,
  "top-charts": (
    <path d="M4 4.4h1.6V6H4zM7.2 4.4H14V6H7.2zM4 8.2h1.6v1.6H4zM7.2 8.2H14v1.6H7.2zM4 12h1.6v1.6H4zM7.2 12H14v1.6H7.2z" />
  ),
  "recently-updated": (
    <path
      d="M9 3.8a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 9 3.8zM9 6v3.2l2.2 1.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  ),
  shows: (
    <>
      <path d="M5.6 4h6.8v1.1H5.6zM4.7 5.9h8.6V7H4.7z" />
      <rect x="3.8" y="7.8" width="10.4" height="6.4" rx="1" />
    </>
  ),
  episodes: <path d="M4 4.6h10v1.5H4zM4 8.2h10v1.5H4zM4 11.9h10v1.5H4z" />,
  downloaded: (
    <path
      d="M9 4v7.2M6 8.6l3 3 3-3M4.6 14h8.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

const LIBRARY: readonly PodcastsSection[] = ["recently-updated", "shows", "episodes", "downloaded"];

/** The icon of a sidebar row: a rounded square in the group's colour with a white glyph. */
export function SectionIcon({ section }: { section: PodcastsSection }) {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <rect
        width="18"
        height="18"
        rx="4"
        style={fill(LIBRARY.includes(section) ? "icon-library" : "icon-store")}
      />
      <g style={GLYPH}>{SECTION_GLYPHS[section]}</g>
    </svg>
  );
}

/** The mark in the display's empty artwork well: a broadcast glyph in the well's own tint. */
export function IdleMark() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M7.4 14.6a6.5 6.5 0 1 1 9.2 0M4.6 17.4a10.4 10.4 0 1 1 14.8 0" />
        <path d="M12 13.5v7" strokeWidth="2.4" />
      </g>
      <circle cx="12" cy="10" r="2.2" fill="currentColor" />
    </svg>
  );
}

/**
 * The glyph before the caption of an episode that has been started: four segments, of which
 * as many are solid as quarters of the episode have been heard. Decorative: the caption says
 * how much is left.
 */
export function ProgressGlyph({ value }: { value: number }) {
  const heard = Math.min(4, Math.floor(Math.min(1, Math.max(0, value)) * 4));
  return (
    <svg
      className="mac-podcasts-progress"
      viewBox="0 0 19 5"
      width="19"
      height="5"
      fill="currentColor"
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((segment) => (
        <rect
          key={segment}
          x={segment * 5}
          width="4"
          height="5"
          rx="1"
          opacity={segment < heard ? 1 : 0.35}
        />
      ))}
    </svg>
  );
}

export type PodcastsPane = "general" | "playback" | "advanced";

const PANE_DRAWINGS: Record<PodcastsPane, ReactNode> = {
  general: (
    <>
      <rect x="5" y="4" width="22" height="24" rx="3" style={PANE_FILL} />
      <rect x="9" y="10" width="14" height="5" rx="2.5" style={PANE_MARK} />
      <circle cx="20.5" cy="12.5" r="3.4" style={PANE_FILL} />
      <rect x="9" y="18" width="14" height="5" rx="2.5" style={PANE_MARK} />
      <circle cx="11.5" cy="20.5" r="3.4" style={PANE_FILL} />
    </>
  ),
  playback: (
    <>
      <circle cx="16" cy="16" r="12" style={fill("icon-store")} />
      <path d="M13 10.5 22 16l-9 5.5z" style={fill("icon-glyph")} />
    </>
  ),
  advanced: (
    <>
      <path
        d="M16 4.5l2.2 3.1 3.7-.9.6 3.8 3.5 1.5-1.6 3.5 1.6 3.5-3.5 1.5-.6 3.8-3.7-.9L16 26.5l-2.2-3.1-3.7.9-.6-3.8L6 19l1.6-3.5L6 12l3.5-1.5.6-3.8 3.7.9z"
        style={PANE_FILL}
      />
      <circle cx="16" cy="15.5" r="4.2" style={PANE_MARK} />
    </>
  ),
};

/** The 32 pt icon of a Preferences toolbar item. */
export function PaneIcon({ pane }: { pane: PodcastsPane }) {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
      {PANE_DRAWINGS[pane]}
    </svg>
  );
}
