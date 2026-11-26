import { Segment, SegmentedControl } from "macalicious/segmented-control";

const stroke = {
  height: 9,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
} as const;

function PageControl() {
  const width = 33;
  return (
    <SegmentedControl aria-label="Page" trackingMode="momentary" size="mini" distribution="fit">
      <Segment aria-label="First page" style={{ width }} disabled>
        <svg aria-hidden="true" width="12" viewBox="0 0 12 9" {...stroke}>
          <path d="M5.53.5 1.53 4.5l4 4m6-8-4 4 4 4" />
        </svg>
      </Segment>
      <Segment aria-label="Previous page" style={{ width }} disabled>
        <svg aria-hidden="true" width="6" viewBox="0 0 6 9" {...stroke}>
          <path d="M4.53.5.53 4.5l4 4" />
        </svg>
      </Segment>
    </SegmentedControl>
  );
}

/**
 * Visual comparison target: the mini page navigator of the Print sheet (rounded style, both
 * segments disabled). The two captures differ, so the example holds one block per appearance
 * and each comparison captures its own with `selector`.
 *
 * Light: crop (2x pixels) x=272 y=860 w=148 h=46, 74 x 23 pt. Bezel edge at x=278..413,
 * y=869..896 (68 x 14 pt, 33 pt segments), so the box starts 2.5 pt from the left and 4 pt from
 * the top. Dark: crop x=184 y=830 w=152 h=46, 76 x 23 pt. Bezel edge at x=192..327, y=839..866
 * (the same 68 x 14 pt), 3.5 pt from the left.
 *
 * The sheet is vibrant: what is behind the control is the blurred desktop picture, which no
 * flat colour reproduces. Each block paints a gradient between the colours measured at the
 * crop's left and right ends. The chevrons are 1.25 pt mitred strokes with 4 pt arms. AppKit
 * does not centre them exactly: the apex of the pair's first chevron is 12 pt from the
 * segment's left edge and the single one's 14 pt (ink at x=301..323 and x=373..384 on the
 * centre row). Their boxes are whole points, 12 x 9 and 6 x 9, so that the browser does not
 * snap them to the pixel grid, and the paths carry the offsets.
 */
export default function VisualPrint() {
  return (
    <div style={{ display: "grid", justifyItems: "start" }}>
      <div
        data-visual="light"
        style={{
          display: "flex",
          alignItems: "flex-start",
          boxSizing: "border-box",
          width: 74,
          height: 23,
          padding: "4px 0 0 2.5px",
          background: "linear-gradient(to right, #b0c2d7, #ccd7e2)",
        }}
      >
        <PageControl />
      </div>
      <div
        data-visual="dark"
        style={{
          display: "flex",
          alignItems: "flex-start",
          boxSizing: "border-box",
          width: 76,
          height: 23,
          padding: "4px 0 0 3.5px",
          background: "linear-gradient(to right, #2c445c, #2d3946)",
        }}
      >
        <PageControl />
      </div>
    </div>
  );
}
