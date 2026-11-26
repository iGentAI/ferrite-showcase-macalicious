import { ProgressSpinner } from "macalicious/progress-spinner";

/**
 * Visual comparison target: the small spinner in the header of the device list of System
 * Preferences › Bluetooth, Dark Aqua. Reference crop (2x pixels) x=1331 y=196 w=40 h=40, i.e.
 * 20 x 20 pt, with the spinner drawn at 15 pt as the pane draws it, at (2.5, 2.5) pt. The Dark Aqua capture caught the frame
 * whose head is at 3 o'clock; the example shows a stopped spinner turned by a quarter.
 */
export default function VisualBluetoothDark() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 20,
        height: 20,
        padding: 2.5,
        background: "light-dark(#f0f0f0, #2b2b2c)",
      }}
    >
      <ProgressSpinner
        size="small"
        animating={false}
        displayedWhenStopped
        aria-label="Searching"
        style={{ display: "block", width: 15, height: 15, rotate: "90deg" }}
      />
    </div>
  );
}
