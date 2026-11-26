import { WindowBanner } from "macalicious/window-banner";

/**
 * Visual comparison target: the "Shared Folder" banner of the Finder Home window.
 *
 * Reference crop (2x pixels) x=444 y=236 w=1800 h=50, i.e. 900 x 25 pt, in both appearances.
 * The banner's content edge is at x=442, one point left of the crop, so the banner is shifted
 * by one point and clipped by the frame.
 */
export default function VisualFinderHome() {
  return (
    <div style={{ width: 900, height: 25, overflow: "hidden" }}>
      <WindowBanner style={{ marginLeft: -1 }}>Shared Folder</WindowBanner>
    </div>
  );
}
