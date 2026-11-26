import { StatusBar } from "macalicious/status-bar";

const swatch = { width: 10, height: 10, background: "var(--mac-color-label)" } as const;

/**
 * Visual check: a message longer than the bar is cut with an ellipsis and the leading and
 * trailing content stay inside the bar. No screenshot shows it; the comparison checks that the
 * trailing swatch is still inside a 300 pt bar.
 */
export default function VisualLongMessage() {
  return (
    <div style={{ width: 300, overflow: "hidden" }}>
      <StatusBar leading={<div style={swatch} />} trailing={<div style={swatch} />}>
        1,204 of 18,662 items selected, 212.44 GB available on Macintosh HD, and counting further
      </StatusBar>
    </div>
  );
}
