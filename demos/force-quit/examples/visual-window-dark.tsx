import { ForceQuit } from "../force-quit";

/**
 * Visual comparison target: the whole Force Quit Applications window of the dark capture,
 * which lists the same three applications with Mail selected.
 * Reference crop (2x pixels) x=112 y=76 w=676 h=614, i.e. the 338 x 307 pt frame, over the
 * capture's transparent margin (matte white).
 */
export default function VisualWindowDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 338,
        height: 307,
        background: "#ffffff",
      }}
    >
      <ForceQuit style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
