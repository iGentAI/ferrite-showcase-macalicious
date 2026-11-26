import { TitleBar } from "macalicious/title-bar";
import { Window } from "macalicious/window";

/**
 * Visual comparison target: the surface of Dictionary's 55 pt unified bar where its toolbar is
 * empty, with `divider="line"`: the two highlight rows, the gradient, and the two bottom rows
 * in one colour.
 *
 * Reference crop 200 x 110 px (100 x 55 pt) between the text size buttons and the window
 * title: x=392 y=76 in both Dictionary captures.
 */
export default function VisualLineSurface() {
  return (
    <div style={{ position: "relative", width: 100, height: 55, overflow: "hidden" }}>
      <Window width={690} height={200} style={{ position: "absolute", left: -140 }}>
        <TitleBar variant="unified" divider="line" style={{ height: 55 }} />
      </Window>
    </div>
  );
}
