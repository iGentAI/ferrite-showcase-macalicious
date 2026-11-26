import { ColorSwatch, ColorSwatchPicker } from "macalicious/color-swatch-picker";
import { ACCENTS } from "macalicious/lib/appearance";

const name = (accent: string) => accent.charAt(0).toUpperCase() + accent.slice(1);

/**
 * Visual comparison target: the accent colour row in the eight accent screenshots of each
 * appearance (Theme-Light-<Accent>, Theme-Dark-<Accent>), in each of which a different swatch
 * is the chosen one. One block per accent; a comparison captures its block with `selector`.
 *
 * Reference crop (2x pixels) x=1472 y=594 w=384 h=48, i.e. 192 x 24 pt: swatches from
 * x=1480, y=602, 4 pt from the crop's left and top. The dark window is #303032 with a colour
 * accent and #323232 with graphite, which switches desktop tinting off.
 */
export default function VisualAccents() {
  return (
    <div style={{ display: "grid" }}>
      {ACCENTS.map((accent) => (
        <div
          key={accent}
          data-visual={accent}
          style={{
            display: "flex",
            boxSizing: "border-box",
            width: 192,
            height: 24,
            padding: "4px 0 0 4px",
            background:
              accent === "graphite"
                ? "light-dark(#ececec, #323232)"
                : "light-dark(#ececec, #303032)",
          }}
        >
          <ColorSwatchPicker aria-label={`Accent color, ${accent} chosen`} defaultValue={accent}>
            {ACCENTS.map((color) => (
              <ColorSwatch key={color} value={color} aria-label={name(color)} />
            ))}
          </ColorSwatchPicker>
        </div>
      ))}
    </div>
  );
}
