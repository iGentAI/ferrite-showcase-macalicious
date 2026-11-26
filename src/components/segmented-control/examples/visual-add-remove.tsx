import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { SystemImage } from "macalicious/system-image";

/**
 * Visual comparison target: the add / remove pair under the folder list of System Preferences,
 * Desktop & Screen Saver (rounded style, momentary, remove disabled).
 *
 * Reference crop (2x pixels) x=172 y=1034 w=110 h=50, i.e. 55 x 25 pt, on the pane's box fill.
 * The bezel's edge is at x=177..276, y=1039..1078 (50 x 20 pt), so the control's box starts
 * 2 pt from the crop's left and top. Both segments are 24 pt wide. AppKit snaps the 11 pt
 * glyphs in the 24 pt segments to whole points, the plus half a point left of centre and the
 * minus half a point right (ink at x=190..211 and x=242..263); the margins reproduce that.
 */
export default function VisualAddRemove() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 55,
        height: 25,
        padding: "2px 0 0 2px",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <SegmentedControl aria-label="Folders" trackingMode="momentary" distribution="fit">
        <Segment aria-label="Add folder" style={{ width: 24 }}>
          <SystemImage name="add" style={{ marginRight: 1 }} />
        </Segment>
        <Segment aria-label="Remove folder" style={{ width: 24 }} disabled>
          <SystemImage name="remove" style={{ marginLeft: 1 }} />
        </Segment>
      </SegmentedControl>
    </div>
  );
}
