import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { SystemImage } from "macalicious/system-image";

/**
 * Visual comparison target: the add / remove / Action control of Finder's Connect to Server
 * window (rounded style, momentary, remove disabled).
 *
 * Reference crop (2x pixels) x=148 y=452 w=206 h=50, i.e. 103 x 25 pt, on the window
 * background. The bezel's edge is at x=153..348, y=457..496 (98 x 20 pt): the control's box
 * starts 2 pt from the crop's left and top, and the segments are 27, 27 and 41 pt wide. The
 * Action segment holds a 14 pt gear and a chevron in a 7 x 7 pt box, 4 pt apart. The chevron
 * is measured (1.5 pt round stroke, 2.7 pt arms at 45 degrees, ink at x=318..331, y=473..481,
 * a little under half a point below the centre line, which its path carries; the box is whole points so
 * that the browser does not snap it to the pixel grid). The gear is Apple's artwork, so the
 * one here is the `action` system image, a stand-in scaled to the same size, and the
 * comparison masks it.
 */
export default function VisualConnectToServer() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 103,
        height: 25,
        padding: "2px 0 0 2px",
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <SegmentedControl aria-label="Favorite servers" trackingMode="momentary" distribution="fit">
        <Segment aria-label="Add to favorites" style={{ width: 27 }}>
          <SystemImage name="add" />
        </Segment>
        <Segment aria-label="Remove from favorites" style={{ width: 27 }} disabled>
          <SystemImage name="remove" />
        </Segment>
        <Segment aria-label="Action" style={{ width: 41 }}>
          <SystemImage name="action" scale={14 / 13} />
          <svg
            width="7"
            height="7"
            viewBox="0 0 7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m.8 2.57 2.7 2.7 2.7-2.7" />
          </svg>
        </Segment>
      </SegmentedControl>
    </div>
  );
}
