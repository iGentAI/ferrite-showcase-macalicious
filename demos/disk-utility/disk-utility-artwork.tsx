/*
 * Original stand-in drawings: Disk Utility's own toolbar glyphs, its sidebar icons and the
 * large disk icon are Apple's artwork and are not reproduced. (The standard glyphs of the
 * toolbar, the sidebar mark of View, the signs of Volume and the i of Info, are the library's
 * system images.) The glyphs draw with `currentColor`; the large icon takes its colours from
 * the demo's token file through `disk-utility.css`.
 */

const glyph = {
  width: 18,
  height: 16,
  viewBox: "0 0 18 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.2,
  focusable: false,
} as const;

/** First Aid: a pulse line across a disc. */
export function FirstAidGlyph() {
  return (
    <svg {...glyph} aria-hidden="true">
      <circle cx="9" cy="8" r="6.4" />
      <path d="M2.6 8h3.2l1.4-3 2.2 6 1.6-3h4.4" strokeLinejoin="round" />
    </svg>
  );
}

/** Partition: a disc cut in three. */
export function PartitionGlyph() {
  return (
    <svg {...glyph} aria-hidden="true">
      <circle cx="9" cy="8" r="6.4" />
      <path d="M9 1.6V8h6.4M9 8l-4.6 4.4" />
    </svg>
  );
}

/** Erase: a sheet being wiped. */
export function EraseGlyph() {
  return (
    <svg {...glyph} aria-hidden="true">
      <path d="M3 2.6h9v10.8H3zM5.2 6h4.6M5.2 8.4h2.6" />
      <path d="M9.4 11.6l5.2-6.4 1.6 1.3-5.2 6.4-2.2.9z" strokeLinejoin="round" />
    </svg>
  );
}

/** Restore: an arrow turning back. */
export function RestoreGlyph() {
  return (
    <svg {...glyph} aria-hidden="true">
      <path d="M5.2 4.4A5.6 5.6 0 1 1 3.6 9.6" />
      <path d="M5.6 1.2v3.6H2" strokeLinejoin="round" />
    </svg>
  );
}

/** Unmount and Mount: a tray with an arrow leaving or entering it. */
export function MountGlyph({ mount = false }: { mount?: boolean }) {
  return (
    <svg {...glyph} aria-hidden="true">
      <path d="M3.4 10.4h11.2v3H3.4z" />
      <path
        d={mount ? "M9 1.6v6M6.4 5.2L9 7.8l2.6-2.6" : "M9 8V2M6.4 4.4L9 1.8l2.6 2.6"}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A sidebar row's 18 pt icon: a drive seen from the front; an internal one shows a platter. */
export function DriveGlyph({ internal = false }: { internal?: boolean }) {
  return (
    <svg
      viewBox="0 0 18 18"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 1.5h10l1 10v4.5H3v-4.5zM3 11.5h12" />
      {internal ? <circle cx="9" cy="6.4" r="2.4" strokeWidth="1" /> : null}
    </svg>
  );
}

/** The mark at the trailing edge of a row that can be unmounted or ejected. */
export function EjectGlyph() {
  return (
    <svg
      viewBox="0 0 8 9"
      width="8"
      height="9"
      style={{ marginInlineEnd: 3 }}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 0l4 5H0zM0 7h8v2H0z" fill="currentColor" />
    </svg>
  );
}

/**
 * The large icon of the detail pane, in a 64 pt box: a drive standing on its base. An external
 * disk's is coloured, an internal one's is metal.
 */
export function DiskIcon({ external = false }: { external?: boolean }) {
  return (
    <svg
      className="mac-disk-utility-icon"
      data-external={external ? "" : undefined}
      width="64"
      height="64"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="mac-disk-utility-icon-body"
        d="M11 4h40a2 2 0 0 1 2 2l3 40H6L9 6a2 2 0 0 1 2-2z"
      />
      <path className="mac-disk-utility-icon-base" d="M6 46h50v12a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" />
      <path className="mac-disk-utility-icon-edge" d="M6 46h50" />
      <circle className="mac-disk-utility-icon-light" cx="49" cy="53.5" r="1.8" />
    </svg>
  );
}
