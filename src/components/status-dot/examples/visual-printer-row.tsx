import { StatusDot } from "macalicious/status-dot";

/**
 * Visual comparison target: the small dot in a printer row's subtitle, System Preferences ›
 * Printers & Scanners. Reference crop (2x pixels) x=244 y=282 w=20 h=20, i.e. 10 x 10 pt with
 * the 6 pt dot at (2, 2) pt, on a row selected in a list without keyboard focus.
 */
export default function VisualPrinterRow() {
  return (
    <div
      style={{
        position: "relative",
        width: 10,
        height: 10,
        background: "light-dark(#dcdcdc, #464646)",
      }}
    >
      <StatusDot
        status="available"
        size="small"
        style={{ position: "absolute", left: 2, top: 2 }}
      />
    </div>
  );
}
