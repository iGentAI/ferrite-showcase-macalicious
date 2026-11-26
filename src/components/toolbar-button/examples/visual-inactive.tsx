import { SystemImage } from "macalicious/system-image";
import { TitleBar } from "macalicious/title-bar";
import { ToolbarButton } from "macalicious/toolbar-button";

/**
 * Visual comparison target: Back, Forward and the sidebar button of the inactive Safari window
 * in the Picture in Picture captures.
 *
 * Reference crop 180 x 52 px (90 x 26 pt), 75 pt right of and 6 pt below the window's corner:
 * x=466 y=116 in the light capture, x=494 y=90 in the dark one. The bar is the 38 pt
 * title-hidden bar; Back starts 78 pt from the window edge, the sidebar button (37 pt) 10 pt
 * after Forward. The sidebar glyph is the `sidebar` system image, a stand-in for Apple's, and
 * is masked in the tight comparison.
 */
export default function VisualInactive() {
  return (
    <div style={{ position: "relative", width: 90, height: 26, overflow: "hidden" }}>
      <TitleBar
        variant="title-hidden"
        style={{ position: "absolute", left: -75, top: -6, width: 600, height: 38 }}
      >
        <div style={{ display: "flex", gap: 1, padding: "8px 78px" }}>
          <ToolbarButton aria-label="Back" style={{ padding: 0 }}>
            <SystemImage name="go-back" />
          </ToolbarButton>
          <ToolbarButton aria-label="Forward" disabled style={{ padding: 0 }}>
            <SystemImage name="go-forward" />
          </ToolbarButton>
          <ToolbarButton aria-label="Sidebar" style={{ width: 37, marginInlineStart: 9 }}>
            <SystemImage name="sidebar" />
          </ToolbarButton>
        </div>
      </TitleBar>
    </div>
  );
}
