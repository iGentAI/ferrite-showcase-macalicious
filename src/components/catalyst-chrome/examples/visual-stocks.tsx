import { CatalystChrome, CatalystSidebar } from "macalicious/catalyst-chrome";
import { Toolbar } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the leading 400 x 70 pt of the Stocks window: window controls, the
 * disabled Back button, the toolbar over the 330 pt sidebar and over the content, and under it
 * the sidebar's fill, its half-point divider and the start of the content.
 *
 * Reference crop (2x pixels) x=112 y=76 w=800 h=140. The sidebar is empty here: the search
 * field of the capture is the app's, and the comparisons mask it and the Back glyph.
 */
export default function VisualStocks() {
  return (
    <div
      style={{
        position: "relative",
        width: 400,
        height: 70,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Window width={1148} height={803} style={{ position: "absolute" }}>
        <CatalystChrome
          title="Stocks"
          controls={<WindowControls />}
          toolbar={
            <Toolbar aria-label="Stocks toolbar">
              <ToolbarButton aria-label="Back" disabled style={{ width: 39 }}>
                <svg
                  width="16"
                  height="14"
                  viewBox="0 0 16 14"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M10 1.500 4.500 7l5.500 5.500"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </ToolbarButton>
            </Toolbar>
          }
          sidebar={<CatalystSidebar aria-label="Watchlist" width={330} divider="shade" />}
        />
      </Window>
    </div>
  );
}
