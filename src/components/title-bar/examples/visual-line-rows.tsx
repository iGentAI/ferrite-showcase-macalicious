import { TitleBar } from "macalicious/title-bar";
import { Window } from "macalicious/window";

/**
 * Visual comparison target: only the last point of the bar of `visual-line-surface`, its two
 * bottom rows, so that the comparison scores the colour of the line and nothing else.
 *
 * Reference crop 200 x 2 px (100 x 1 pt): x=392 y=184 in both Dictionary captures, rows 108
 * and 109 of the window.
 */
export default function VisualLineRows() {
  return (
    <div style={{ position: "relative", width: 100, height: 1, overflow: "hidden" }}>
      <Window width={690} height={200} style={{ position: "absolute", left: -140, top: -54 }}>
        <TitleBar variant="unified" divider="line" style={{ height: 55 }} />
      </Window>
    </div>
  );
}
