import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Language & Region pane, 668 x 517 pt, in the state the Aqua
 * capture shows.
 *
 * Reference crop x=112 y=76 w=1336 h=1034: the opaque frame without its shadow.
 */
export default function VisualLanguageAndRegion() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 517,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="language-and-region" />
    </div>
  );
}
