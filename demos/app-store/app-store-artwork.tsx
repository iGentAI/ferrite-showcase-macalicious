import type { CSSProperties, ReactNode } from "react";
import type {
  AppStoreArtwork,
  AppStoreColor,
  AppStoreGlyph,
  AppStoreSection,
} from "./app-store-data";

/*
 * Stand-in drawings. The store's photographs, its editorial artwork, the icons of the apps and
 * the sidebar's glyphs are Apple's or the apps' own; none of them is reproduced or imitated.
 * The glyphs and the stand-in icons are original drawings in the boxes the capture measures.
 * The hero's picture, the stories' round artworks and the invented apps' icons are generated
 * originals (./art) that take nothing from the pictures in the screenshots; the abstract
 * drawings remain as their fallbacks. Everything is painted from the demo's tokens.
 */

/* Paint from the demo's tokens. In `style`, since a custom property there is resolved like any
   other declaration. */
const fill = (token: string): CSSProperties => ({ fill: `var(--mac-app-store-${token})` });

/* Generated artwork, all original: the icons of the invented apps (`icon-<app id>`), the
   stories' editorial pictures (`story-<story id>`) and the hero's photograph (`hero-<id>`).
   Where there is none, as for the apps that carry a real product's name, the stand-in
   drawing below is used instead. */
const ART: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./art/*.webp", { eager: true, query: "?url", import: "default" }),
  ).map(([file, url]) => [file.slice("./art/".length, -".webp".length), url]),
);

const COVER: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

/** A generated picture filling its box, decorative, or nothing when there is none. */
function Art({ name, className }: { name: string; className?: string }) {
  const url = ART[name];
  if (!url) return null;
  return <img className={className} src={url} alt="" draggable={false} style={COVER} />;
}

/* One glyph per sidebar row, on a 26 x 24 pt box, in the row's tint. */
const SECTION_GLYPHS: Record<AppStoreSection, ReactNode> = {
  discover: (
    <path
      d="M13 1.1 15.88 8.64 23.94 9.05 17.66 14.11 19.76 21.9 13 17.5 6.24 21.9 8.34 14.11 2.06 9.05 10.12 8.64z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  ),
  arcade: (
    <>
      <circle cx="13" cy="4.4" r="3.3" />
      <path d="M12 7h2v6.5h-2z" />
      <path d="M13 10.8 24.5 15.3 13 19.8 1.5 15.3zM11 12.6v3h4v-3z" fillRule="evenodd" />
      <path d="M1.5 17.5 13 22l11.5-4.5v1.8L13 23.8 1.5 19.3z" />
    </>
  ),
  create: (
    <>
      <path d="M3.6 21 12.6 12" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M11.4 9 15.6 4.8c1.7-1.7 4.5-1.5 6 .3 1.3 1.6 1.1 4-.4 5.5L17 14.6z" />
    </>
  ),
  work: <path d="M1.8 11.4 24.2 2.4 18 21.4 12.6 15.2 20.4 6.4 9.4 13.6zM10.8 16.4v5.4l3.2-3.3z" />,
  play: (
    <>
      <path
        d="M22.8 2.2c-5.9 0-10.6 3-13.5 8.1L8 12.6l5.4 5.4 2.3-1.3c5.1-2.9 8.1-7.6 8.1-13.5zM17.2 6.2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
        fillRule="evenodd"
      />
      <path d="M8 9.4 3.3 11 1.8 14.4l4.7-.7zM16.6 17l-1.6 4.7-3.4 1.5.7-4.7zM5.3 17.3c1.7-.2 3 1.1 2.8 2.8-.2 1.5-2.6 2.3-5.2 2.4.1-2.6.9-5 2.4-5.2z" />
    </>
  ),
  develop: (
    <>
      <path d="M3.4 21 13.4 11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M13.4 2.4l7.4 3.3c1 .5 1.8 1.3 2.2 2.4l1 2.7-3 1.2-1.1-2.3-2.3-.5-2.2 2.2-4-4z" />
    </>
  ),
  categories: (
    <>
      <rect x="3.5" y="6.6" width="19" height="16" rx="4" />
      <rect x="6.5" y="3.7" width="13" height="1.6" rx=".8" />
      <rect x="8.5" y="1.1" width="9" height="1.4" rx=".7" />
    </>
  ),
  updates: (
    <>
      <path d="M12.1 1h1.8v3h-1.8z" />
      <path
        d="M8 4h10a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V9a5 5 0 0 1 5-5zM12.1 4v9.8L8.8 10.5 7.5 11.8 13 17.3l5.5-5.5-1.3-1.3-3.3 3.3V4z"
        fillRule="evenodd"
      />
    </>
  ),
};

/** The glyph of a sidebar row, in the row's tint. Decorative: the row's label names it. */
export function SectionGlyph({ section }: { section: AppStoreSection }) {
  return (
    <svg viewBox="0 0 26 24" width="26" height="24" fill="currentColor" aria-hidden="true">
      {SECTION_GLYPHS[section]}
    </svg>
  );
}

/** The account button's avatar: a head and shoulders in a ring, 40 pt across. */
export function Avatar() {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <circle cx="20" cy="20" r="18.25" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="20" cy="15.8" r="6.6" fill="currentColor" />
      <path
        d="M8.3 31.2c1.6-3.3 6.2-5.4 11.7-5.4s10.1 2.1 11.7 5.4A16.5 16.5 0 0 1 20 36.5a16.5 16.5 0 0 1-11.7-5.3z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * The picture of a hero: an abstract placeholder, a pale field with a band and three plain
 * discs. It stands where the store has a photograph and takes nothing from it. It fills its
 * box, cropped to cover it. Decorative.
 */
export function HeroPicture({ id }: { id?: string } = {}) {
  if (id && ART[`hero-${id}`]) {
    return <Art name={`hero-${id}`} className="mac-app-store-hero-picture" />;
  }
  return (
    <svg
      className="mac-app-store-hero-picture"
      viewBox="0 0 945 340"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="945" height="340" style={fill("placeholder-field")} />
      <path d="M0 260 945 180v160H0z" style={fill("placeholder-band")} />
      <circle cx="700" cy="150" r="96" style={fill("placeholder-disc")} />
      <circle cx="812" cy="208" r="58" style={fill("placeholder-mark")} />
      <circle cx="590" cy="232" r="34" style={fill("placeholder-accent")} />
    </svg>
  );
}

/* The shapes of a story's round artwork, on a 170 pt box, over the placeholder field: four
   abstract figures of plain geometry, so that the stories can be told apart. */
const ARTWORKS: Record<AppStoreArtwork, ReactNode> = {
  arcs: (
    <>
      <circle cx="85" cy="170" r="100" style={fill("placeholder-band")} />
      <circle cx="85" cy="170" r="66" style={fill("placeholder-disc")} />
      <circle cx="85" cy="170" r="32" style={fill("placeholder-mark")} />
    </>
  ),
  bars: (
    <>
      <rect x="38" y="92" width="22" height="78" style={fill("placeholder-band")} />
      <rect x="74" y="58" width="22" height="112" style={fill("placeholder-disc")} />
      <rect x="110" y="76" width="22" height="94" style={fill("placeholder-mark")} />
    </>
  ),
  orbits: (
    <>
      <circle
        cx="85"
        cy="85"
        r="58"
        fill="none"
        strokeWidth="10"
        style={{ stroke: "var(--mac-app-store-placeholder-band)" }}
      />
      <circle cx="85" cy="85" r="28" style={fill("placeholder-disc")} />
      <circle cx="134" cy="54" r="12" style={fill("placeholder-accent")} />
    </>
  ),
  tiles: (
    <>
      <rect x="36" y="36" width="44" height="44" rx="8" style={fill("placeholder-disc")} />
      <rect x="90" y="36" width="44" height="44" rx="8" style={fill("placeholder-band")} />
      <rect x="36" y="90" width="44" height="44" rx="8" style={fill("placeholder-mark")} />
      <rect x="90" y="90" width="44" height="44" rx="8" style={fill("placeholder-accent")} />
    </>
  ),
};

/**
 * The round artwork of a story: an abstract placeholder of plain shapes on a pale field,
 * standing where the store has editorial artwork. It fills the box it is placed in.
 * Decorative: the story's text names it.
 */
export function StoryArtwork({ artwork, id }: { artwork: AppStoreArtwork; id?: string }) {
  if (id && ART[`story-${id}`]) {
    return (
      <span className="mac-app-store-art" aria-hidden="true">
        <Art name={`story-${id}`} />
      </span>
    );
  }
  return (
    <svg
      className="mac-app-store-art"
      viewBox="0 0 170 170"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      {ARTWORKS[artwork]}
    </svg>
  );
}

/* The glyphs of the stand-in app icons, on a 50 pt box, in the icon's glyph colour. */
const ICON_GLYPHS: Record<AppStoreGlyph, ReactNode> = {
  bolt: <path d="M28 8 13 28h10l-2 14 16-21H26z" />,
  brackets: (
    <path
      d="M19 13l-9 12 9 12M31 13l9 12-9 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  brush: <path d="M36 9l5 5-15 16-6-6zM18 27l5 5c-1 5-6 8-13 7 3-2 3-4 3-6 0-3 2-5 5-6z" />,
  chart: <path d="M11 28h6v11h-6zM22 19h6v20h-6zM33 11h6v28h-6z" />,
  column: <path d="M12 12h26v4H12zM15 18h4v16h-4zM23 18h4v16h-4zM31 18h4v16h-4zM11 36h28v4H11z" />,
  dice: (
    <path
      d="M15 10h20a5 5 0 0 1 5 5v20a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5V15a5 5 0 0 1 5-5zM18 15.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2zM25 22.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2zM32 29.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z"
      fillRule="evenodd"
    />
  ),
  film: <path d="M11 19h28v19a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2zM11 11h28v5H11z" />,
  flag: <path d="M14 10h3v30h-3zM19 12h18l-5 7 5 7H19z" />,
  flame: <path d="M25 8c2 7 10 10 10 20a10 10 0 0 1-20 0c0-4 2-7 4-9 0 4 2 5 3 5 0-6 1-11 3-16z" />,
  grid: (
    <path d="M14 12h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM29 12h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM14 27h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM29 27h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" />
  ),
  house: <path d="M25 11 10 24h4v14h8v-9h6v9h8V24h4z" />,
  leaf: (
    <path d="M38 11c-14 0-25 6-25 18 0 3 1 6 3 8 2-9 7-15 15-19-6 5-10 12-11 21 12 1 19-9 18-28z" />
  ),
  note: (
    <path
      d="M15 10h20a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3zM17 17v2.5h16V17zM17 23.5V26h16v-2.5zM17 30v2.5h10V30z"
      fillRule="evenodd"
    />
  ),
  pen: <path d="M33 9l8 8-19 19-10 3 3-10z" />,
  shield: <path d="M25 9l13 4v10c0 9-5 15-13 18-8-3-13-9-13-18V13z" />,
  star: (
    <path d="M25 11 28.76 20.82 39.27 21.36 31.09 27.98 33.82 38.14 25 32.4 16.18 38.14 18.91 27.98 10.73 21.36 21.24 20.82z" />
  ),
  wave: (
    <path
      d="M9 25c4-10 8-10 12 0s8 10 12 0c2-5 5-7 8-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
  ),
};

export interface AppIconProps {
  /** The glyph on the icon. */
  glyph: AppStoreGlyph;
  /** The two system colours of its gradient. */
  colors: readonly [AppStoreColor, AppStoreColor];
  /** The app's id: its generated icon is used when there is one. */
  id?: string;
}

/**
 * An app's icon: a rounded square in a gradient of two system colours with a white glyph. It
 * stands for the app's own icon and fills the box it is placed in. Decorative: the lockup
 * names the app in text.
 */
export function AppIcon({ glyph, colors, id }: AppIconProps) {
  if (id && ART[`icon-${id}`]) {
    return (
      <span className="mac-app-store-icon" aria-hidden="true">
        <Art name={`icon-${id}`} />
      </span>
    );
  }
  return (
    <span
      className="mac-app-store-icon"
      aria-hidden="true"
      style={{
        background: `linear-gradient(135deg, var(--mac-color-system-${colors[0]}), var(--mac-color-system-${colors[1]}))`,
      }}
    >
      <svg viewBox="0 0 50 50" width="100%" height="100%" fill="currentColor" aria-hidden="true">
        {ICON_GLYPHS[glyph]}
      </svg>
    </span>
  );
}
