import { NetworkUtility } from "../network-utility";
import { darkCaptureInterfaces } from "../network-utility-data";

/**
 * Visual comparison target: the whole Network Utility window of the Dark Aqua capture, whose
 * transfer statistics differ from the Aqua capture's. Reference crop (2x pixels) x=112 y=76
 * w=1288 h=770, i.e. the 644 x 385 pt frame, over the capture's transparent margin (matte
 * white).
 */
export default function VisualWindowDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 644,
        height: 385,
        background: "#ffffff",
      }}
    >
      <NetworkUtility
        interfaces={darkCaptureInterfaces}
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}
