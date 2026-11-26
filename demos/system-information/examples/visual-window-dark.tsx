import { SystemInformation } from "../system-information";
import { darkCaptureItems } from "../system-information-data";

/**
 * Visual comparison target: the whole System Information window of the dark capture, whose
 * overview names a later firmware than the light one.
 * Reference crop (2x pixels) x=112 y=76 w=1502 h=1040, i.e. the 751 x 520 pt frame, over the
 * capture's transparent margin (matte white).
 */
export default function VisualWindowDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 751,
        height: 520,
        background: "#ffffff",
      }}
    >
      <SystemInformation items={darkCaptureItems} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
