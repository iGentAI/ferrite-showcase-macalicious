/*
 * The demo's glyphs: original drawings with `currentColor`, on the boxes measured in the Safari
 * captures. None is Apple's artwork.
 */
const line = { fill: "none", stroke: "currentColor" } as const;

function Glyph({
  width,
  height,
  d,
  fill,
  strokeWidth = 1,
}: {
  width: number;
  height: number;
  /** Stroked path. */
  d?: string;
  /** Filled path. */
  fill?: string;
  strokeWidth?: number;
}) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {fill ? <path d={fill} fill="currentColor" /> : null}
      {d ? <path d={d} {...line} strokeWidth={strokeWidth} strokeLinejoin="round" /> : null}
    </svg>
  );
}

export function ChevronGlyph({ forward = false }: { forward?: boolean }) {
  return (
    <svg
      width="7"
      height="12"
      viewBox="0 0 7 12"
      aria-hidden="true"
      style={forward ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M6 0.5L0.75 6l5.5 5.5" {...line} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** A window with its sidebar column marked. */
export function SidebarGlyph() {
  return <Glyph width={16} height={12} d="M0.5 0.5h15v11h-15zM5.5 0.5v11M2 3h2M2 5h2M2 7h2" />;
}

/** Two overlapping rounded squares; the one behind shows its top and trailing sides. */
export function TabOverviewGlyph() {
  return (
    <Glyph
      width={12}
      height={12}
      strokeWidth={1.2}
      d="M3.5 2.2V2A1.5 1.5 0 0 1 5 .5h5A1.5 1.5 0 0 1 11.5 2v5A1.5 1.5 0 0 1 10 8.5h-.2M2 3.5h5A1.5 1.5 0 0 1 8.5 5v5A1.5 1.5 0 0 1 7 11.5H2A1.5 1.5 0 0 1 .5 10V5A1.5 1.5 0 0 1 2 3.5z"
    />
  );
}

/**
 * A glyph of the Share menu's rows in the 16 x 15 pt box of a menu's template image, which gives its
 * row the 20 pt of Safari's: glasses for the Reading List, a book for Bookmarks, an ellipsis in a
 * circle for More….
 */
export function ShareRowGlyph({ kind }: { kind: "reading-list" | "bookmark" | "more" }) {
  return (
    <svg width="16" height="15" viewBox="0 0 16 15" aria-hidden="true">
      <path
        d={
          kind === "more"
            ? "M14.4 7.5a6.4 6.4 0 1 1-12.800 0 6.4 6.4 0 0 1 12.800 0zM4.200 7.500h1.600M7.200 7.500h1.600M10.200 7.500h1.600"
            : kind === "bookmark"
              ? "M8 4C6.5 2.5 3.5 2.1.5 2.5V12c3-.4 6 0 7.5 1.2 1.5-1.2 4.5-1.6 7.5-1.2V2.5c-3-.4-6 0-7.5 1.5zM8 4v9"
              : "M7 7.5a3.2 2.8 0 1 1-6.4 0 3.2 2.8 0 0 1 6.4 0zM15.4 7.5a3.2 2.8 0 1 1-6.4 0 3.2 2.8 0 0 1 6.4 0zM7 7.2c.7-.6 1.3-.6 2 0"
        }
        {...line}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** An open book. */
export function BookGlyph() {
  return (
    <Glyph
      width={16}
      height={12}
      d="M8 2.5C6.5 1 3.5 0.6 0.5 1v9.5c3-.4 6 0 7.5 1.2 1.5-1.2 4.5-1.6 7.5-1.2V1c-3-.4-6 0-7.5 1.5zM8 2.5v9"
    />
  );
}

/** A pair of glasses. */
export function GlassesGlyph() {
  return (
    <Glyph
      width={20}
      height={8}
      d="M8.5 4a4 3.5 0 1 1-8 0 4 3.5 0 0 1 8 0zM19.5 4a4 3.5 0 1 1-8 0 4 3.5 0 0 1 8 0zM8.5 3.6c1-.8 2-.8 3 0"
    />
  );
}

export function StarGlyph() {
  return (
    <Glyph
      width={14}
      height={14}
      d="M7 1l1.8 3.9 4.2.5-3.1 2.9.8 4.2L7 10.4l-3.7 2.1.8-4.2L1 5.4l4.2-.5z"
    />
  );
}

export function FolderGlyph() {
  return <Glyph width={14} height={12} d="M0.5 2.5v9h13v-9zM0.5 2.5v-2h5l1 2M0.5 4.5h13" />;
}

/** A globe: a disc with a meridian and two parallels. */
export function GlobeGlyph() {
  return (
    <Glyph
      width={14}
      height={14}
      d="M13.5 7a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0zM7 0.5c-4 3.5-4 9.5 0 13 4-3.5 4-9.5 0-13zM1 5h12M1 9h12"
    />
  );
}

/**
 * Stand-in for the icon of a service in the Share menu, which in Catalina is an application's
 * icon: a rounded square in one of the demo's six tints.
 */
export function ServiceIcon({ tint }: { tint: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        rx="3.5"
        style={{ fill: `var(--mac-safari-tint-${tint})` }}
      />
    </svg>
  );
}

/**
 * Stand-in for a preference pane's icon, which in Catalina is Apple's full-colour artwork: a
 * rounded square in a system colour with a simple white mark. The mark's colour is a token of
 * the demo, so the stylesheet of `Safari` or `SafariPreferences` must be loaded.
 */
export function PaneIcon({ color, mark }: { color: string; mark: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="6" fill={color} />
      <path
        d={mark}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: "var(--mac-safari-on-tint)" }}
      />
    </svg>
  );
}
