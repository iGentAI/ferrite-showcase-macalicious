import { ColorSwatch, ColorSwatchPicker } from "macalicious/color-swatch-picker";
import { ACCENTS } from "macalicious/lib/appearance";

const name = (accent: string) => accent.charAt(0).toUpperCase() + accent.slice(1);

/**
 * Visual comparison target: the accent colour row of System Preferences, General, with Blue
 * chosen.
 *
 * Reference crop (2x pixels) x=606 y=346 w=384 h=48, i.e. 192 x 24 pt, on the pane
 * background. The eight swatches are 16 pt discs at a 24 pt pitch, the first at x=614..645,
 * y=354..385: 4 pt from the crop's left and top.
 */
export default function VisualGeneral() {
  return (
    <div
      style={{
        display: "flex",
        boxSizing: "border-box",
        width: 192,
        height: 24,
        padding: "4px 0 0 4px",
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <ColorSwatchPicker aria-label="Accent color" defaultValue="blue">
        {ACCENTS.map((color) => (
          <ColorSwatch key={color} value={color} aria-label={name(color)} />
        ))}
      </ColorSwatchPicker>
    </div>
  );
}
