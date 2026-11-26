import { Segment, SegmentedControl } from "macalicious/segmented-control";

/**
 * Fixture for the states no reference screenshot shows (pressed, keyboard focus, a window that
 * is not key, another accent, a disabled control). `segmented-control.visual.json` puts it into
 * each state with real input and checks the pixels it expects.
 *
 * 276 x 37 pt: 8 pt of page on every side, so the focus ring is inside the capture. Each
 * control is 124 pt wide (three 40 pt segments, two dividers, the hairline at both ends) and
 * 21 pt high. The first control's box is x 8 to 132, its fill x 9 to 131 and y 9 to 28; its
 * segments are x 9 to 49 (selected), 50 to 90 and 91 to 131, with dividers at x 49 and 90. The
 * second control, disabled, starts at x 144.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", gap: 12, padding: 8 }}>
      <SegmentedControl aria-label="View" distribution="fit" defaultValue={["one"]}>
        <Segment id="one" value="one" style={{ width: 40 }}>
          A
        </Segment>
        <Segment id="two" value="two" style={{ width: 40 }}>
          B
        </Segment>
        <Segment id="three" value="three" style={{ width: 40 }}>
          C
        </Segment>
      </SegmentedControl>
      <SegmentedControl aria-label="Unavailable view" distribution="fit" disabled>
        <Segment value="one" style={{ width: 40 }}>
          A
        </Segment>
        <Segment value="two" style={{ width: 40 }}>
          B
        </Segment>
        <Segment value="three" style={{ width: 40 }}>
          C
        </Segment>
      </SegmentedControl>
    </div>
  );
}
