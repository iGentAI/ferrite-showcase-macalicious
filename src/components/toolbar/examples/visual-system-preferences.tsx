import { SystemImage } from "macalicious/system-image";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the whole chrome of the System Preferences window: the 38 pt bar
 * with the title hidden from the title strip and centred over the toolbar row.
 *
 * Reference crop x=112 y=76 w=1336 h=76 (668 x 38 pt). Window controls at 13 pt, zoom disabled;
 * Back and Forward (27 pt each) from 78 pt; the Show All button (38 pt) at 141 pt; the search
 * field (160 pt) ending 8 pt from the right edge. The title, the Show All glyph and the
 * placeholder are masked in the tight comparison.
 */
export default function VisualSystemPreferences() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 38,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Window width={668} height={200} style={{ position: "absolute" }}>
        <TitleBar variant="title-hidden" title="General" controls={<WindowControls zoomDisabled />}>
          <Toolbar aria-label="System Preferences toolbar">
            <ToolbarSegmentedControl variant="navigation" tracking="momentary" aria-label="History">
              <ToolbarSegment aria-label="Back" style={{ width: 27, padding: 0 }}>
                <SystemImage name="go-back" />
              </ToolbarSegment>
              <ToolbarSegment aria-label="Forward" disabled style={{ width: 27, padding: 0 }}>
                <SystemImage name="go-forward" />
              </ToolbarSegment>
            </ToolbarSegmentedControl>
            <ToolbarButton aria-label="Show All" style={{ width: 38 }}>
              <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
                <path
                  d="M0 1h2M4 1h2M8 1h2M12 1h2M0 5h2M4 5h2M8 5h2M12 5h2M0 9h2M4 9h2M8 9h2M12 9h2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </ToolbarButton>
            <ToolbarSpace />
            <ToolbarSearchField />
          </Toolbar>
        </TitleBar>
      </Window>
    </div>
  );
}
