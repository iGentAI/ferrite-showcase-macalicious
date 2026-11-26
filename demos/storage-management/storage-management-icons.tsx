/**
 * Stand-ins for the glyphs of the sidebar, which are Apple's artwork: a plain disc for
 * Recommendations and a plain rounded square for a category, 20 pt across as the glyphs of
 * the reference screenshots are, drawn in the row's tint.
 */
export function SidebarGlyph({ shape }: { shape: "disc" | "square" }) {
  return (
    <svg
      className="mac-storage-management-glyph"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="1.5"
        y="1.5"
        width="17"
        height="17"
        rx={shape === "disc" ? 8.5 : 4}
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
      />
    </svg>
  );
}

/** The mark of a recommendation that was carried out: a check in a disc. An original drawing. */
export function CompletedMark() {
  return (
    <svg
      className="mac-storage-management-mark"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      <path
        className="mac-storage-management-mark-check"
        d="M4.4 8.3l2.5 2.5 4.7-5.4"
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
