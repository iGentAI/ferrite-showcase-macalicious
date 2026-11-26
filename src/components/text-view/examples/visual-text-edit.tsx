import { TextView } from "macalicious/text-view";

/**
 * Visual comparison target: the top left of a TextEdit document.
 *
 * Reference crop (2x pixels) x=116 y=236 w=400 h=60, that is 200 x 30 pt from the ruler's
 * bottom border, starting 2 pt inside the window's left edge (in Dark Aqua the window's rim
 * covers the first point). TextEdit's default font is Helvetica 12 on a 14 pt line, which the
 * example sets; the first glyph sits 5.75 pt from the window's edge and its cap top 2 pt below
 * the view's top.
 */
export default function VisualTextEdit() {
  return (
    <div style={{ width: 200, height: 30, overflow: "hidden" }}>
      <div style={{ width: 202, height: 30, marginLeft: -2 }}>
        <TextView
          aria-label="Document"
          defaultValue="Here's to the crazy ones..."
          spellCheck={false}
          style={{ font: "12px / 14px Helvetica, Arial, sans-serif", overflow: "hidden" }}
        />
      </div>
    </div>
  );
}
