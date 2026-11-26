import { Segment, SegmentedControl } from "macalicious/segmented-control";

/**
 * Fixture for the small size, which no reference screenshot shows: an 82 x 18 pt control and
 * nothing else, so the capture is the control's own box. `segmented-control.visual.json` checks
 * its size and bezel.
 */
export default function VisualSmall() {
  return (
    <SegmentedControl
      aria-label="View"
      size="small"
      distribution="fit"
      trackingMode="momentary"
      style={{ display: "grid" }}
    >
      <Segment style={{ width: 40 }}>A</Segment>
      <Segment style={{ width: 39 }}>B</Segment>
    </SegmentedControl>
  );
}
