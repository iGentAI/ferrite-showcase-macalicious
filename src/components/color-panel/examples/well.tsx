import { ColorPanelWell } from "macalicious/color-panel";
import { Label } from "macalicious/label";

/** A colour well that opens the Colors panel in place of the browser's colour chooser. */
export default function Well() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Label id="well-fill-label">Fill:</Label>
      <ColorPanelWell
        aria-labelledby="well-fill-label"
        defaultValue="#ff9300"
        panel={{ showsAlpha: true }}
      />
    </div>
  );
}
