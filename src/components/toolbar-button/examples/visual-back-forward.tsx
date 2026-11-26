import { SystemImage } from "macalicious/system-image";
import { TitleBar } from "macalicious/title-bar";
import { ToolbarButton } from "macalicious/toolbar-button";

/**
 * Visual comparison target: Back (enabled) and Forward (disabled) in the key Finder window.
 *
 * Reference crop (2x pixels) x=124 y=122 w=110 h=52, i.e. 55 x 26 pt, 6 pt right of and 23 pt
 * below the window's top-left corner. The buttons are 25 pt wide and 1 pt apart, starting
 * 8 pt from the window edge and 25 pt below its top, on the 55 pt unified title bar.
 */
export default function VisualBackForward() {
  return (
    <div style={{ position: "relative", width: 55, height: 26, overflow: "hidden" }}>
      <TitleBar
        variant="unified"
        style={{ position: "absolute", left: -6, top: -23, width: 926, height: 55 }}
      >
        <div style={{ display: "flex", gap: 1, padding: "3px 8px" }}>
          <ToolbarButton aria-label="Back" style={{ padding: 0 }}>
            <SystemImage name="go-back" />
          </ToolbarButton>
          <ToolbarButton aria-label="Forward" disabled style={{ padding: 0 }}>
            <SystemImage name="go-forward" />
          </ToolbarButton>
        </div>
      </TitleBar>
    </div>
  );
}
