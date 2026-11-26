import { Dictionary } from "../dictionary";

/**
 * Visual comparison target: the whole Dictionary window of the captures, searching for
 * "computer" in the Dictionary source. Reference crop (2x pixels) x=112 y=76 w=1380 h=1300,
 * i.e. the 690 x 650 pt frame, over the capture's transparent margin (matte white). The
 * comparison clicks in the search field, which has the keyboard in the captures.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 690,
        height: 650,
        background: "#ffffff",
      }}
    >
      <Dictionary style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
