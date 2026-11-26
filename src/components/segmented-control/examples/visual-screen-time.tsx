import { Segment, SegmentedControl } from "macalicious/segmented-control";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * Visual comparison target: the day navigator of System Preferences, Screen Time (separated
 * style, momentary, on white; the third segment is disabled).
 *
 * Reference crop (2x pixels) x=1146 y=206 w=248 h=58, i.e. 124 x 29 pt. The three bezels are
 * 23, 67 and 23 pt wide, 1 pt apart (edges at x=1155..1200, 1203..1336, 1339..1384, y=215..254),
 * so the segments' boxes are 24, 68 and 24 pt and the control starts 4 pt from the crop's left
 * and top. The chevrons are 1.5 pt round strokes with 5.2 pt arms at 45 degrees. Their apex is
 * 7.5 pt from the outer edge of the bezel and half a point below its centre line (apex centre
 * at x=1170.5, y=236), so the two icons carry that offset in their 9 x 13 pt boxes.
 */
export default function VisualScreenTime() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 124,
        height: 29,
        padding: "4px 0 0 4px",
        background: "light-dark(#ffffff, #1e1e1e)",
      }}
    >
      <SegmentedControl
        aria-label="Day"
        trackingMode="momentary"
        variant="separated"
        distribution="fit"
      >
        <Segment aria-label="Previous day" style={{ width: 24 }}>
          <svg aria-hidden="true" width="9" height="13" viewBox="0 0 9 13" {...stroke}>
            <path d="M5.95 1.8.75 7l5.2 5.2" />
          </svg>
        </Segment>
        <Segment style={{ width: 68 }}>Today</Segment>
        <Segment aria-label="Next day" style={{ width: 24 }} disabled>
          <svg aria-hidden="true" width="9" height="13" viewBox="0 0 9 13" {...stroke}>
            <path d="m2.9 1.8 5.2 5.2-5.2 5.2" />
          </svg>
        </Segment>
      </SegmentedControl>
    </div>
  );
}
