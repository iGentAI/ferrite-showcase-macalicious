import {
  CatalystChrome,
  CatalystSidebar,
  CatalystSidebarGroup,
  CatalystSidebarItem,
} from "macalicious/catalyst-chrome";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

export default function Basic() {
  return (
    <Window width={420} height={220}>
      <CatalystChrome
        title="Reader"
        controls={<WindowControls />}
        sidebar={
          <CatalystSidebar aria-label="Sections" width={150}>
            <CatalystSidebarGroup title="Library">
              <CatalystSidebarItem selected>Today</CatalystSidebarItem>
              <CatalystSidebarItem>Saved</CatalystSidebarItem>
            </CatalystSidebarGroup>
          </CatalystSidebar>
        }
      >
        <p style={{ margin: 16, font: "var(--mac-catalyst-chrome-font-large-title)" }}>Today</p>
      </CatalystChrome>
    </Window>
  );
}
