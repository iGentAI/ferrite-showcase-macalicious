import { SmartListTile, SmartListTileGrid } from "macalicious/smart-list-tile";

/**
 * Visual check target for the states no screenshot shows: two glyphless 120 x 59 pt tiles on
 * the sidebar colour measured beside the tiles of the Reminders captures. The first is the
 * tile whose list is shown and takes the system blue; the second is at rest, to be pressed
 * and focused with real input.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 264,
        height: 75,
        padding: 8,
        background: "light-dark(#e7e7e6, #2c2d2e)",
      }}
    >
      <SmartListTileGrid aria-label="Smart Lists">
        <SmartListTile defaultPressed data-tile="shown">
          Today
        </SmartListTile>
        <SmartListTile data-tile="rest">All</SmartListTile>
      </SmartListTileGrid>
    </div>
  );
}
