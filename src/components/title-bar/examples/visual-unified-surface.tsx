import { TitleBar } from "macalicious/title-bar";
import { Window } from "macalicious/window";

/**
 * Visual comparison target: the surface of the 55 pt unified bar of the key Finder window,
 * taken where the toolbar is empty: the two highlight rows, the gradient, the shadow row and
 * the separator.
 *
 * Reference crop 200 x 110 px (100 x 55 pt) between the last toolbar button and the search
 * field: x=1096 y=76 in the light capture, x=1200 in the dark one.
 */
export default function VisualUnifiedSurface() {
  return (
    <div style={{ position: "relative", width: 100, height: 55, overflow: "hidden" }}>
      <Window width={926} height={200} style={{ position: "absolute", left: -400 }}>
        <TitleBar variant="unified" style={{ height: 55 }} />
      </Window>
    </div>
  );
}
