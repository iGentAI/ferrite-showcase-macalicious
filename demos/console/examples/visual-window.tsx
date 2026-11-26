import { Console } from "../console";
import { defaultSelectedId } from "../console-data";

/**
 * Visual comparison target: the whole Console window of the light capture. Now is on, so the
 * table shows the last of its 9,318 messages; the message selected is an earlier one, out of
 * view, which the detail pane shows. The stream is stopped.
 * Reference crop (2x pixels) x=112 y=76 w=2000 h=1000, i.e. the 1000 x 500 pt frame, over the
 * capture's transparent margin (matte white).
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1000,
        height: 500,
        background: "#ffffff",
      }}
    >
      <Console
        streamInterval={0}
        material="opaque"
        defaultSelectedId={defaultSelectedId}
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}
