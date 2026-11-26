import { CatalystChrome, CatalystSidebar, CatalystSidebarItem } from "macalicious/catalyst-chrome";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/**
 * Fixture for what no screenshot shows: the chrome in a window that is not key, with content
 * under the toolbar. 300 x 120 pt; the toolbar is the first 38 pt, the sidebar 100 pt wide
 * with its selected row from y 38 to 64, the content black.
 */
export default function VisualInactive() {
  return (
    <div
      style={{
        position: "relative",
        width: 300,
        height: 120,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Window
        state="inactive"
        width={300}
        height={200}
        aria-label="Recordings"
        style={{ position: "absolute" }}
      >
        <CatalystChrome
          controls={<WindowControls />}
          underToolbar
          sidebar={
            <CatalystSidebar aria-label="Folders" width={100}>
              <CatalystSidebarItem selected>All</CatalystSidebarItem>
            </CatalystSidebar>
          }
        >
          <div style={{ height: 200, background: "#000" }} />
        </CatalystChrome>
      </Window>
    </div>
  );
}
