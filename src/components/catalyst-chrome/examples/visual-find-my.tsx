import { CatalystChrome, CatalystSidebar } from "macalicious/catalyst-chrome";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import type { CSSProperties } from "react";

/* Find My's own sidebar colours, measured on its captures (fill @ 400,276 and 356,452; the
   line's two half points @ 634,300 and 590,300, as one point of their mean). */
const FIND_MY = {
  "--mac-catalyst-chrome-sidebar-fill": "light-dark(#f8f7f4, #1f2021)",
  "--mac-catalyst-chrome-sidebar-divider": "light-dark(#e4e3de, #343536)",
} as CSSProperties;

/**
 * Visual comparison target: the leading 300 x 36 pt of the Find My window, which has no toolbar
 * row: the window controls 8 pt from the edge in the 22 pt strip, over the 261 pt sidebar in
 * Find My's fill, the sidebar's one-point line and the start of the map.
 *
 * Reference crop (2x pixels) w=600 h=72 from the window's corner: x=112 y=76 in the Aqua
 * capture, x=68 y=52 in the Dark Aqua one, whose window is not key.
 */
export default function VisualFindMy({ state }: Pick<WindowProps, "state">) {
  return (
    <div
      style={{
        position: "relative",
        width: 300,
        height: 36,
        overflow: "hidden",
        background: "black",
      }}
    >
      <Window
        aria-label="Find My"
        state={state}
        topHighlight
        width={1135}
        height={723}
        style={{ position: "absolute" }}
      >
        <CatalystChrome
          bar="none"
          controls={<WindowControls />}
          sidebar={
            <CatalystSidebar
              aria-label="People and devices"
              width={261}
              divider="plain"
              style={FIND_MY}
            />
          }
        >
          <div style={{ height: "100%", background: "light-dark(#f9f5ed, #2b2d2f)" }} />
        </CatalystChrome>
      </Window>
    </div>
  );
}
