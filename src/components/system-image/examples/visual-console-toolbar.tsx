import { SystemImage } from "macalicious/system-image";

/**
 * Visual comparison target: the glyphs of Console's Reload and Share toolbar buttons, each on
 * the fill of its button.
 *
 * Reference crops (2x pixels) 36 x 36 at x=557 y=127 (Reload) and x=861 y=128 (Share), odd origins so that each glyph starts on a whole point, i.e.
 * 18 x 18 pt each, placed side by side here; a comparison captures one of the two boxes. The
 * reload glyph is 11 x 13 pt, 2 pt from its crop's left edge and 3 pt from its top; the
 * share glyph is 11 x 15 pt, 3 pt from the left and 2 pt from the top. The button's fill
 * is a gradient three levels deep over the crop; the middle value is painted here.
 */
export default function VisualConsoleToolbar() {
  const box = {
    position: "relative",
    width: 18,
    height: 18,
    color: "light-dark(#575757, #ffffff)",
    background: "light-dark(#f8f8f8, #6b6d6e)",
  } as const;
  return (
    <div style={{ display: "flex" }}>
      <div id="reload" style={box}>
        <SystemImage name="refresh" style={{ position: "absolute", left: 2, top: 3 }} />
      </div>
      <div id="share" style={box}>
        <SystemImage name="share" style={{ position: "absolute", left: 3, top: 2 }} />
      </div>
    </div>
  );
}
