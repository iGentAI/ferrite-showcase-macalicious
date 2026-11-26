import { SystemImage } from "macalicious/system-image";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { WindowControls } from "macalicious/window-controls";

/** A toolbar on the surface of a unified title bar: Tab reaches it, arrow keys move in it. */
export default function Basic() {
  return (
    <TitleBar
      variant="unified"
      title="Documents"
      controls={<WindowControls />}
      style={{ width: 460 }}
    >
      <Toolbar aria-label="Documents toolbar">
        <ToolbarSegmentedControl variant="navigation" tracking="momentary" aria-label="History">
          <ToolbarSegment aria-label="Back" style={{ padding: 0 }}>
            <SystemImage name="go-back" />
          </ToolbarSegment>
          <ToolbarSegment aria-label="Forward" disabled style={{ padding: 0 }}>
            <SystemImage name="go-forward" />
          </ToolbarSegment>
        </ToolbarSegmentedControl>
        <ToolbarButton aria-label="Share" style={{ width: 38 }}>
          <SystemImage name="share" />
        </ToolbarButton>
        <ToolbarSpace />
        <ToolbarSearchField />
      </Toolbar>
    </TitleBar>
  );
}
