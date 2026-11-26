import { SystemImage } from "macalicious/system-image";
import { TitleBar } from "macalicious/title-bar";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";

/**
 * Visual comparison target: the Back and Forward pair of the key Finder window, as the
 * navigation style of the segmented control.
 *
 * Reference crop x=124 y=122 w=110 h=52 (55 x 26 pt), 6 pt right of and 23 pt below the
 * window's corner. Two 25 pt segments, 1 pt apart; Forward is disabled.
 */
export default function VisualNavigation() {
  return (
    <div style={{ position: "relative", width: 55, height: 26, overflow: "hidden" }}>
      <TitleBar
        variant="unified"
        style={{ position: "absolute", left: -6, top: -23, width: 926, height: 55 }}
      >
        <div style={{ padding: "3px 8px" }}>
          <ToolbarSegmentedControl variant="navigation" tracking="momentary" aria-label="History">
            <ToolbarSegment aria-label="Back" style={{ padding: 0 }}>
              <SystemImage name="go-back" />
            </ToolbarSegment>
            <ToolbarSegment aria-label="Forward" disabled style={{ padding: 0 }}>
              <SystemImage name="go-forward" />
            </ToolbarSegment>
          </ToolbarSegmentedControl>
        </div>
      </TitleBar>
    </div>
  );
}
