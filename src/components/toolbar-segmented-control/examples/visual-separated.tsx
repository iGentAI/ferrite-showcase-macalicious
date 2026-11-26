import { TitleBar } from "macalicious/title-bar";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";

/* Stand-in magnifier with a minus or a plus: an original drawing, not Apple's artwork. */
function Zoom({ plus = false }: { plus?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <circle cx="6.5" cy="6.5" r="5" />
        <path d={plus ? "M10.2 10.2l4.3 4.3M4 6.5h5M6.5 4v5" : "M10.2 10.2l4.3 4.3M4 6.5h5"} />
      </g>
    </svg>
  );
}

/**
 * Visual comparison target: the separated zoom-out and zoom-in pair of Preview's toolbar.
 *
 * Reference crop x=212 y=122 w=160 h=52 (80 x 26 pt) of the Preview captures, the same in both
 * appearances: 2 pt left of and 2 pt above the first segment's fill. The fills are 39 and
 * 37 pt wide and their hairline borders touch (row 150: fills to column 293 and from 296,
 * borders at 294 and 295), 52 pt from the window's left edge. The glyphs are
 * stand-ins and are masked in the tight comparison.
 */
export default function VisualSeparated() {
  return (
    <div style={{ position: "relative", width: 80, height: 26, overflow: "hidden" }}>
      <TitleBar
        variant="unified"
        style={{ position: "absolute", left: -50, top: -23, width: 926, height: 55 }}
      >
        <div style={{ padding: "3px 52px" }}>
          <ToolbarSegmentedControl variant="separated" tracking="momentary" aria-label="Zoom">
            <ToolbarSegment aria-label="Zoom Out" style={{ width: 39, padding: 0 }}>
              <Zoom />
            </ToolbarSegment>
            <ToolbarSegment aria-label="Zoom In" style={{ width: 37, padding: 0 }}>
              <Zoom plus />
            </ToolbarSegment>
          </ToolbarSegmentedControl>
        </div>
      </TitleBar>
    </div>
  );
}
