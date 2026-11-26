import {
  CatalystChrome,
  CatalystSidebar,
  CatalystSidebarGroup,
  CatalystSidebarItem,
} from "macalicious/catalyst-chrome";
import { Toolbar } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import type { CSSProperties } from "react";

/* The capture's sidebar: 227 pt in Aqua, 234 pt in Dark Aqua. The chrome reads it from the
   sidebar's style for the toolbar's darker stretch over the column. */
const COLUMN = {
  "--mac-catalyst-chrome-sidebar-width": "calc(227px + 7px * var(--mac-appearance-dark))",
} as CSSProperties;

/** A block of one colour the size of the measured row icon; the comparisons mask it. */
function Block() {
  return (
    <svg viewBox="0 0 8 8" width="18.5" height="18.5" aria-hidden="true" focusable="false">
      <path d="M0 0h8v8H0z" fill="#6aa6d8" />
    </svg>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Visual comparison target: the leading 300 x 304 pt of the News window: window controls, the
 * disabled Back button at 77.5 pt and the sidebar button 7 pt after it, then the sidebar from
 * its first header to the Business row, its divider and the start of the content.
 *
 * Reference crop (2x pixels) x=112 y=76 w=600 h=608. The sidebar is 227 pt wide in the Aqua
 * capture and 234 pt in the Dark Aqua one, whose window is wider. The row icons and the two
 * button glyphs are stand-in drawings, masked in every comparison.
 */
export default function VisualNews() {
  return (
    <div
      style={{
        position: "relative",
        width: 300,
        height: 304,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Window width={1222} height={842} style={{ position: "absolute" }}>
        <CatalystChrome
          title="News"
          controls={<WindowControls />}
          toolbar={
            <Toolbar aria-label="News toolbar">
              <ToolbarButton aria-label="Back" disabled style={{ width: 39 }}>
                <Glyph d="M10 1.500 4.500 7l5.500 5.500" />
              </ToolbarButton>
              <ToolbarButton aria-label="Hide Sidebar" style={{ width: 39 }}>
                <Glyph d="M1.500 1.500h13v11h-13zM6 1.500v11M3 4h1.500M3 6h1.500" />
              </ToolbarButton>
            </Toolbar>
          }
          sidebar={
            <CatalystSidebar aria-label="Channels" style={COLUMN}>
              <CatalystSidebarGroup title="Apple News">
                <CatalystSidebarItem icon={<Block />} selected>
                  Today
                </CatalystSidebarItem>
                <CatalystSidebarItem icon={<Block />}>News+</CatalystSidebarItem>
                <CatalystSidebarItem icon={<Block />}>Saved Stories</CatalystSidebarItem>
                <CatalystSidebarItem icon={<Block />}>History</CatalystSidebarItem>
              </CatalystSidebarGroup>
              <CatalystSidebarGroup title="Following">
                <CatalystSidebarItem icon={<Block />}>News Top Stories</CatalystSidebarItem>
                <CatalystSidebarItem icon={<Block />}>Apple News Spotlight</CatalystSidebarItem>
              </CatalystSidebarGroup>
              <CatalystSidebarGroup title="Suggested by Siri">
                <CatalystSidebarItem icon={<Block />}>Business</CatalystSidebarItem>
              </CatalystSidebarGroup>
            </CatalystSidebar>
          }
        />
      </Window>
    </div>
  );
}
