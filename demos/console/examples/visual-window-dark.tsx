import { Console } from "../console";
import { darkCaptureMessages, darkCaptureSelectedId } from "../console-data";

/**
 * Visual comparison target: the whole Console window of the dark capture, which lists 86
 * other messages than the light one and shows another message in its detail pane.
 * Reference crop (2x pixels) x=112 y=76 w=2000 h=1000, i.e. the 1000 x 500 pt frame, over the
 * capture's transparent margin (matte white).
 */
export default function VisualWindowDark() {
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
        messages={darkCaptureMessages}
        streamInterval={0}
        material="opaque"
        defaultSelectedId={darkCaptureSelectedId}
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}
