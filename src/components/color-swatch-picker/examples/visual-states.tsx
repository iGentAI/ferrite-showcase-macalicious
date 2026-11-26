import { ColorSwatch, ColorSwatchPicker } from "macalicious/color-swatch-picker";

/**
 * Fixture for the states no reference screenshot shows (pressed, keyboard focus, a window that
 * is not key, a disabled swatch, a swatch of another colour). `color-swatch-picker.visual.json`
 * puts it into each state with real input and checks the pixels it expects.
 *
 * 144 x 32 pt: 8 pt of page on every side, so the focus ring is inside the capture. The
 * swatches are 16 pt discs at a 24 pt pitch from x 8, y 8: Blue (chosen) is centred on
 * x 16, Purple on 40, the grey of any other colour on 64; the disabled picker's Red is centred
 * on x 104 and its chosen Green on 128. Every centre is on y 16.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", gap: 24, padding: 8 }}>
      <ColorSwatchPicker aria-label="Color" defaultValue="blue">
        <ColorSwatch value="blue" aria-label="Blue" />
        <ColorSwatch value="purple" aria-label="Purple" />
        <ColorSwatch value="other" color="#808080" aria-label="Gray" />
      </ColorSwatchPicker>
      <ColorSwatchPicker aria-label="Unavailable color" defaultValue="green" disabled>
        <ColorSwatch value="red" aria-label="Red" />
        <ColorSwatch value="green" aria-label="Green" />
      </ColorSwatchPicker>
    </div>
  );
}
