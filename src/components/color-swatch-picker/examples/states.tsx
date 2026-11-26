import { ColorSwatch, ColorSwatchPicker } from "macalicious/color-swatch-picker";
import { ACCENTS } from "macalicious/lib/appearance";
import type { ReactNode } from "react";

const name = (accent: string) => accent.charAt(0).toUpperCase() + accent.slice(1);

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

function Row({
  label,
  force,
  disabled,
  disabledSwatch,
  readOnly,
  windowState,
}: {
  label: string;
  force?: "pressed" | "focus";
  disabled?: boolean;
  disabledSwatch?: string;
  readOnly?: boolean;
  windowState?: string;
}): ReactNode {
  return (
    <div style={cell} data-window-state={windowState}>
      <span style={caption}>{label}</span>
      <ColorSwatchPicker
        aria-label={label}
        defaultValue="blue"
        disabled={disabled}
        readOnly={readOnly}
      >
        {ACCENTS.map((color) => (
          <ColorSwatch
            key={color}
            value={color}
            aria-label={name(color)}
            disabled={color === disabledSwatch}
            data-force={
              force && color === (force === "pressed" ? "purple" : "blue") ? force : undefined
            }
          />
        ))}
      </ColorSwatchPicker>
    </div>
  );
}

/**
 * Every state; Blue is the chosen swatch throughout. Pressed and focused are transient, so
 * this gallery pins them with the `data-force` preview attribute: pressed on Purple, the focus
 * ring on Blue. A window that is not key shows no focus ring; the swatches and the dot stay.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(2, max-content)", gap: "16px 28px" }}
    >
      <Row label="Normal and chosen" />
      <Row label="Pressed" force="pressed" />
      <Row label="Keyboard focus" force="focus" />
      <Row label="One swatch disabled" disabledSwatch="red" />
      <Row label="Disabled" disabled />
      <Row label="Read-only" readOnly />
      <Row label="Main window, not key" windowState="main" force="focus" />
      <Row label="Inactive window" windowState="inactive" force="focus" />
    </div>
  );
}
