import { Label } from "macalicious/label";

/**
 * Visual comparison target: the hint under "Use Wi-Fi…" in System Preferences > Network, the
 * only 10 pt label in the reference set.
 *
 * Reference crop (2x pixels) x=860 y=704 w=460 h=96, i.e. 230 x 48 pt on the pane's box. Three
 * lines of 10 pt text in the opaque text colour on a 13 pt pitch.
 */
export default function VisualMiniText() {
  return (
    <div
      style={{
        position: "relative",
        width: 230,
        height: 48,
        background: "light-dark(#e3e3e3, #353637)",
      }}
    >
      <Label
        textStyle="mini"
        color="text"
        style={{ position: "absolute", left: 3, top: 4, whiteSpace: "pre" }}
      >
        {
          "Known networks will be joined automatically. If\nno known networks are available, you will have\nto manually select a network."
        }
      </Label>
    </div>
  );
}
