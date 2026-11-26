import { SystemImage } from "macalicious/system-image";

/**
 * Visual comparison target: the glyph of Finder's Edit Tags toolbar button, which is disabled
 * in both Home captures (nothing is selected).
 *
 * Reference crop (2x pixels) w=42 h=28 at y=134: x=1013 in the Aqua capture, x=1011 in the
 * Dark Aqua one, where the toolbar puts the glyph 1 pt further left. That is 21 x 14 pt, the
 * 17 x 10 pt image 2 pt from the crop's left and top edges, on the button's fill (#fafafa to
 * #f4f4f4 down the crop in Aqua, #68696b to #666769 in Dark Aqua). The glyph is #acacac in
 * Aqua and #8f9192 in Dark Aqua, the colour of a disabled toolbar glyph.
 */
export default function VisualTag() {
  return (
    <div
      style={{
        position: "relative",
        width: 21,
        height: 14,
        color: "light-dark(#acacac, #8f9192)",
        background: "linear-gradient(light-dark(#fafafa, #68696b), light-dark(#f4f4f4, #666769))",
      }}
    >
      <SystemImage name="tag" style={{ position: "absolute", left: 2, top: 2 }} />
    </div>
  );
}
