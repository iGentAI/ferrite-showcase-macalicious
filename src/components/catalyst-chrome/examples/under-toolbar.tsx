import { CatalystChrome } from "macalicious/catalyst-chrome";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/**
 * Content under the toolbar: the bar is translucent and takes the colour of what is beneath,
 * here a drawn gradient that stands in for a wallpaper. Scroll the content to see it pass
 * under the bar.
 */
export default function UnderToolbar() {
  return (
    <Window width={420} height={240}>
      <CatalystChrome
        title="Rooms"
        controls={<WindowControls />}
        underToolbar
        toolbar={
          <Toolbar aria-label="Rooms toolbar">
            <ToolbarSpace />
            <ToolbarButton aria-label="Add" style={{ width: 39 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                <path d="M6 .500v11M.500 6h11" stroke="currentColor" strokeLinecap="round" />
              </svg>
            </ToolbarButton>
          </Toolbar>
        }
      >
        <div
          data-appearance="dark"
          style={{
            minHeight: 420,
            padding: "calc(var(--mac-catalyst-chrome-toolbar-inset) + 16px) 16px 16px",
            background: "linear-gradient(160deg, #2b7a8c, #1b3f5c 60%, #47305e)",
            color: "var(--mac-color-label)",
          }}
        >
          <h2 style={{ margin: 0, font: "var(--mac-catalyst-chrome-font-large-title)" }}>Rooms</h2>
          <p style={{ margin: "8px 0 0", font: "var(--mac-catalyst-chrome-font-title)" }}>
            Two lights are on.
          </p>
        </div>
      </CatalystChrome>
    </Window>
  );
}
