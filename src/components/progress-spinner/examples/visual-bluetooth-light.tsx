import { ProgressSpinner } from "macalicious/progress-spinner";

/**
 * Visual comparison target: the small spinner in the header of the device list of System
 * Preferences › Bluetooth, on the plain header background, in both captures. Reference crop
 * (2x pixels) x=1331 y=196 w=40 h=40, i.e. 20 x 20 pt. The pane draws the small spinner at 15 pt, not 16 (its ink is columns 1336 to
 * 1365 and rows 201 to 230), so the example gives it that size, at (2.5, 2.5) pt.
 * The Aqua capture caught the frame whose head is at 12 o'clock, where a stopped spinner has
 * it.
 */
export default function VisualBluetoothLight() {
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
        style={{ display: "block", width: 15, height: 15 }}
      />
    </div>
  );
}
