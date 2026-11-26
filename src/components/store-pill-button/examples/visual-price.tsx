import { StorePillButton } from "macalicious/store-pill-button";

/**
 * Visual comparison target: the offer button of the second lockup column, the price `$14.99`
 * without a caption.
 *
 * Reference crop (2x pixels) x=1732 y=1455 w=156 h=62, i.e. 78 x 31 pt. The capsule is at
 * 6, 5 in the crop (1744, 1465 in the capture).
 */
export default function VisualPrice() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 78,
        height: 31,
        padding: "5px 0 0 6px",
        background: "light-dark(#ffffff, #1e1f22)",
      }}
    >
      <StorePillButton>$14.99</StorePillButton>
    </div>
  );
}
