import { CatalystChrome, CatalystSidebar, CatalystSidebarItem } from "macalicious/catalyst-chrome";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/**
 * Fixture for what no screenshot shows: the chrome where a stylesheet, not a `dir` attribute,
 * sets the direction. 400 x 70 pt; the window is 400 pt wide, the sidebar 200 pt, so the
 * sidebar's column is the right half and the toolbar's darker stretch lies over it.
 */
export default function VisualRtl() {
  return (
    <div
      style={{
        position: "relative",
        width: 400,
        height: 70,
        overflow: "hidden",
        direction: "rtl",
        background: "white",
      }}
    >
      <Window width={400} height={200} aria-label="Stocks" style={{ position: "absolute" }}>
        <CatalystChrome
          controls={<WindowControls />}
          sidebar={
            <CatalystSidebar aria-label="Watchlist" width={200} divider="shade">
              <CatalystSidebarItem>All</CatalystSidebarItem>
            </CatalystSidebar>
          }
        />
      </Window>
    </div>
  );
}
