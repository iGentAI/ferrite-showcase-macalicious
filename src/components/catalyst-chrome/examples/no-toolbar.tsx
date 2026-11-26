import { CatalystChrome, CatalystSidebar, CatalystSidebarItem } from "macalicious/catalyst-chrome";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/**
 * A chrome without a toolbar row, as in Find My: the window controls float over a sidebar that
 * takes the window's whole height and ends in a plain line, and the content starts at the
 * window's top edge. The window is named by `aria-label` and draws its own top highlight.
 */
export default function NoToolbar() {
  return (
    <Window aria-label="Places" topHighlight width={420} height={220}>
      <CatalystChrome
        bar="none"
        controls={<WindowControls />}
        sidebar={
          <CatalystSidebar aria-label="Places" width={150} divider="plain">
            <CatalystSidebarItem selected>Home</CatalystSidebarItem>
            <CatalystSidebarItem>Work</CatalystSidebarItem>
            <CatalystSidebarItem>School</CatalystSidebarItem>
          </CatalystSidebar>
        }
      >
        <p style={{ margin: 0, padding: 16, font: "var(--mac-catalyst-chrome-font-body)" }}>
          The content starts at the window's top edge.
        </p>
      </CatalystChrome>
    </Window>
  );
}
