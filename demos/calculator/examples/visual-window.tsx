import { Calculator } from "../calculator";

/**
 * Visual comparison target: the whole window capture, 688 x 866 px, i.e. 344 x 433 pt. The
 * window's frame starts 56 pt from the left and 38 pt from the top; the rest is its shadow,
 * over the white the comparison puts behind the capture's transparent pixels.
 *
 * The Dark Aqua capture shows the calculator cleared, as it is here. For the Aqua capture the
 * comparison clicks `4` and `2` first.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 344,
        height: 433,
        padding: "38px 0 0 56px",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      <Calculator />
    </div>
  );
}
