import { StorePillButton } from "macalicious/store-pill-button";

/**
 * Visual comparison target: the first offer button of the App Store's lockup list, `GET` with
 * its `In-App Purchases` caption.
 *
 * Reference crop (2x pixels) x=1090 y=1455 w=156 h=84, i.e. 78 x 42 pt, on the page colour of
 * each capture. The capsule is at 6, 5 in the crop (1102, 1465 in the capture); the caption's
 * capitals start 7 pt below it.
 */
export default function VisualGet() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 78,
        height: 42,
        padding: "5px 0 0 6px",
        background: "light-dark(#ffffff, #1e1f22)",
      }}
    >
      <StorePillButton caption="In-App Purchases">Get</StorePillButton>
    </div>
  );
}
