import { ColorSwatch, ColorSwatchPicker } from "macalicious/color-swatch-picker";
import { ACCENTS, type Accent } from "macalicious/lib/appearance";
import { useState } from "react";

const name = (accent: string) => accent.charAt(0).toUpperCase() + accent.slice(1);

/**
 * An accent picker at work: the chosen value becomes `data-accent` on the wrapper, and
 * everything inside that is tinted with the accent follows, here a line of text and the
 * picker's own focus ring (press Tab). The swatches themselves keep their colours.
 */
export default function Accents() {
  const [accent, setAccent] = useState<Accent>("purple");
  return (
    <div data-accent={accent} style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <ColorSwatchPicker aria-label="Accent color" value={accent} onValueChange={setAccent}>
        {ACCENTS.map((color) => (
          <ColorSwatch key={color} value={color} aria-label={name(color)} />
        ))}
      </ColorSwatchPicker>
      <span style={{ font: "var(--mac-font-control-regular)", color: "var(--mac-accent)" }}>
        Accent color: {name(accent)}
      </span>
    </div>
  );
}
