import { RoundRectButton } from "macalicious/round-rect-button";

/**
 * Visual comparison target: "Connect As…" and "Share Screen…" under the selected server in the
 * preview column of Finder's Network window.
 *
 * Reference crop 244 x 106 px (122 x 53 pt) at y=416, x=983 in the light capture and x=870 in
 * the dark one. Each button is 114 x 18 pt, 4 pt from the crop's left edge; the first is 4 pt
 * from its top and the second 27 pt under the first. The column's fill is #f5f5f5 in Aqua and
 * #252628 in Dark Aqua.
 */
export default function VisualFinderNetwork() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "grid",
        gap: 9,
        alignContent: "start",
        justifyItems: "start",
        width: 122,
        height: 53,
        padding: "4px 0 0 4px",
        background: "light-dark(#f5f5f5, #252628)",
      }}
    >
      <RoundRectButton style={{ width: 114 }}>Connect As…</RoundRectButton>
      <RoundRectButton style={{ width: 114 }}>Share Screen…</RoundRectButton>
    </div>
  );
}
