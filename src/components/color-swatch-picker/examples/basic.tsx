import { ColorSwatch, ColorSwatchPicker } from "macalicious/color-swatch-picker";
import { ACCENTS } from "macalicious/lib/appearance";
import { useState } from "react";

const name = (accent: string) => accent.charAt(0).toUpperCase() + accent.slice(1);

/** The accent colour picker of System Preferences: eight swatches, one chosen. */
export default function Basic() {
  const [accent, setAccent] = useState("blue");
  return (
    <ColorSwatchPicker aria-label="Accent color" value={accent} onValueChange={setAccent}>
      {ACCENTS.map((color) => (
        <ColorSwatch key={color} value={color} aria-label={name(color)} />
      ))}
    </ColorSwatchPicker>
  );
}
