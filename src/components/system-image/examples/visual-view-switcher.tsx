import { SystemImage } from "macalicious/system-image";
import { TitleBar } from "macalicious/title-bar";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";

/**
 * Visual comparison target: the four view-mode images in the Finder view switcher, with the
 * column view selected, as in the toolbar segmented control's own comparison.
 *
 * Reference crop 228 x 52 px (114 x 26 pt) around the 110 pt control, 2 pt to its left and
 * 2 pt above its fill: x=448 y=122 in the light capture, x=382 in the dark one, where the
 * toolbar has one item less before it. The four images are stand-in drawings on the measured
 * glyph box.
 */
export default function VisualViewSwitcher() {
  return (
    <div style={{ position: "relative", width: 114, height: 26, overflow: "hidden" }}>
      <TitleBar
        variant="unified"
        style={{ position: "absolute", left: -168, top: -23, width: 926, height: 55 }}
      >
        <div style={{ padding: "3px 170px" }}>
          <ToolbarSegmentedControl defaultValue={["columns"]} aria-label="View">
            <ToolbarSegment value="icons" aria-label="Icons">
              <SystemImage name="icon-view" />
            </ToolbarSegment>
            <ToolbarSegment value="list" aria-label="List">
              <SystemImage name="list-view" />
            </ToolbarSegment>
            <ToolbarSegment value="columns" aria-label="Columns" style={{ padding: "0 6px 0 5px" }}>
              <SystemImage name="column-view" />
            </ToolbarSegment>
            <ToolbarSegment value="gallery" aria-label="Gallery">
              <SystemImage name="gallery-view" />
            </ToolbarSegment>
          </ToolbarSegmentedControl>
        </div>
      </TitleBar>
    </div>
  );
}
