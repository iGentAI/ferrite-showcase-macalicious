import { AirPortUtility } from "../airport-utility";

/**
 * Visual comparison target: the whole AirPort Utility window of the two captures, which show
 * the same dark window, with no base station set up.
 * Reference crop (2x pixels) x=112 y=76 w=1392 h=1064, i.e. the 696 x 532 pt frame, over the
 * capture's transparent margin (matte white).
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 696,
        height: 532,
        background: "var(--mac-airport-utility-visual-matte)",
      }}
    >
      <AirPortUtility style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
