import { ScriptEditor } from "../script-editor";

/**
 * Visual comparison target: the whole Script Editor window of the Aqua capture. Reference
 * crop (2x pixels) x=112 y=76 w=1400 h=1410, i.e. the 700 x 705 pt frame, over the capture's
 * transparent margin (matte white).
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 700,
        height: 705,
        background: "#ffffff",
      }}
    >
      <ScriptEditor style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
