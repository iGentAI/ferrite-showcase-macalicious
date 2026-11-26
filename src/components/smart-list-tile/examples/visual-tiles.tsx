import { SmartListTile, SmartListTileGrid } from "macalicious/smart-list-tile";
import type { ReactNode } from "react";

/* Stand-in glyphs on the disc's 24 pt grid, drawn for this example. Not Apple's artwork. */
const glyph = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
    {children}
  </svg>
);
const PAGE = glyph(
  <path
    fill="currentColor"
    fillRule="evenodd"
    d="M7.5 6h9A1.5 1.5 0 0 1 18 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6Zm-.25 4v6.5c0 .14.11.25.25.25h9c.14 0 .25-.11.25-.25V10Z"
  />,
);
const CLOCK = glyph(
  <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="5.75" />
    <path d="M12 8.5V12h2.75" strokeLinejoin="round" />
  </g>,
);
const TRAY = glyph(
  <path
    fill="currentColor"
    fillRule="evenodd"
    d="M8.4 7h7.2c.5 0 .95.3 1.15.76L18.5 12v3.5A1.5 1.5 0 0 1 17 17H7a1.5 1.5 0 0 1-1.5-1.5V12l1.75-4.24C7.45 7.3 7.9 7 8.4 7Zm.17 1.25L7.03 12H9.5a2.5 2.5 0 0 0 5 0h2.47l-1.54-3.75Z"
  />,
);
const FLAG = glyph(
  <g fill="currentColor">
    <rect x="7.5" y="6" width="1.5" height="12" rx="0.75" />
    <path d="M9.75 6.75h7.1c.35 0 .53.42.29.67L15.4 9.6l1.74 2.18c.24.25.06.67-.29.67h-7.1Z" />
  </g>,
);

/**
 * Visual comparison target: the four smart-list tiles of 10-15-Catalina-Light-Reminders.png
 * and 10-15-Catalina-Dark-Reminders.png. Reference crop (2x pixels) x=128 y=240 w=528 h=284:
 * the 2 x 2 grid of 120 x 59 pt tiles, 8 pt apart, with 8 pt of the sidebar around it. No tile
 * is the one shown. The sidebar behind the tiles is the colour measured beside them; the grey
 * of the All tile's disc is the measured one, which no shared token holds.
 */
export default function VisualTiles() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 264,
        height: 142,
        padding: 8,
        background: "light-dark(#e7e7e6, #2c2d2e)",
      }}
    >
      <SmartListTileGrid aria-label="Smart Lists">
        <SmartListTile icon={PAGE} count={0}>
          Today
        </SmartListTile>
        <SmartListTile icon={CLOCK} count={0} tint="var(--mac-color-system-orange)">
          Scheduled
        </SmartListTile>
        <SmartListTile icon={TRAY} count={18} tint="#5b626a">
          All
        </SmartListTile>
        <SmartListTile icon={FLAG} count={0} tint="var(--mac-color-system-red)">
          Flagged
        </SmartListTile>
      </SmartListTileGrid>
    </div>
  );
}
