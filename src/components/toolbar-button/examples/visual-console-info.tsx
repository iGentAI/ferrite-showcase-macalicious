import { ToolbarButton } from "macalicious/toolbar-button";

const LETTER =
  "M7.5 2.9a1.2 1.2 0 1 0 0 2.4a1.2 1.2 0 0 0 0-2.4zM5.7 6.4v1.1h1v3.1h-1v1.1h3.7v-1.1h-.9V6.4z";

/**
 * Visual comparison target: the middle of Console's Info button, a toggle that is on and
 * shows it by its glyph.
 *
 * Reference crop (2x pixels) x=722 y=118 w=68 h=60, i.e. 34 x 30 pt, 21 pt below the window's
 * top: the bezel's top and bottom edges and the 15 pt disc, centred in the 44 pt button, on
 * Console's 68 pt chrome. The button's ends are outside the crop. The letter in the disc is a
 * stand-in drawing; the tight comparisons mask it.
 *
 * The backdrop is the capture's own bar (column 730, y=78 and y=209), not the library's title
 * bar material: the dark Console window is seven levels lighter than that material, and the
 * dark bezel is translucent, so its fill follows the bar.
 */
export default function VisualConsoleInfo() {
  return (
    <div style={{ position: "relative", width: 34, height: 30, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: "-21px 0 auto",
          height: 67,
          background: "linear-gradient(light-dark(#e4e4e4, #474849), light-dark(#d0d1d1, #3c3d3e))",
        }}
      />
      <ToolbarButton
        aria-label="Info"
        pressedStyle="tint"
        defaultPressed
        style={{ position: "absolute", left: -5, top: 4, width: 44, padding: 0 }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
          <path d={`M7.5 0a7.5 7.5 0 1 0 0 15a7.5 7.5 0 0 0 0-15z${LETTER}`} fill="currentColor" />
          <path d={LETTER} fill="var(--mac-toolbar-button-glyph-mark)" />
        </svg>
      </ToolbarButton>
    </div>
  );
}
