import { Toolbar } from "macalicious/toolbar";
import { ToolbarLabelledItem } from "macalicious/toolbar-labelled-item";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";

/**
 * Visual check: in the toolbar's label-only mode a segmented control keeps its segments, since
 * one label cannot stand for several actions. No screenshot shows label-only mode; the
 * comparison checks that the bezel is drawn.
 */
export default function VisualLabelOnlySegments() {
  return (
    <div style={{ background: "var(--mac-material-titlebar)", width: 120 }}>
      <Toolbar displayMode="label-only" aria-label="Toolbar">
        <ToolbarLabelledItem label="Volume">
          <ToolbarSegmentedControl tracking="momentary" style={{ width: 60 }}>
            <ToolbarSegment aria-label="Add Volume">+</ToolbarSegment>
            <ToolbarSegment aria-label="Delete Volume">-</ToolbarSegment>
          </ToolbarSegmentedControl>
        </ToolbarLabelledItem>
      </Toolbar>
    </div>
  );
}
