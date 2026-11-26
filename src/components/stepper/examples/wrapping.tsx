import { Stepper } from "macalicious/stepper";
import { useState } from "react";

const field = {
  boxSizing: "border-box",
  width: 34,
  height: 22,
  padding: "0 4px",
  border: "var(--mac-hairline) solid var(--mac-color-field-border)",
  background: "var(--mac-color-text-field-background)",
  color: "var(--mac-color-control-text)",
  font: "var(--mac-font-control-regular)",
  lineHeight: "21px",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
} as const;

/**
 * A stepper that wraps: past 59 the minutes start again at 0. The stepper sits 4 pt to the
 * right of the field that shows its value, and `aria-valuetext` gives the value its spoken
 * form.
 */
export default function Wrapping() {
  const [minutes, setMinutes] = useState(58);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span id="minutes-label" style={{ font: "var(--mac-font-control-regular)", marginRight: 4 }}>
        Minutes:
      </span>
      <output id="minutes-value" style={field}>
        {String(minutes).padStart(2, "0")}
      </output>
      <Stepper
        aria-labelledby="minutes-label"
        aria-controls="minutes-value"
        aria-valuetext={`${minutes} minutes`}
        value={minutes}
        onValueChange={setMinutes}
        min={0}
        max={59}
        valueWraps
      />
    </div>
  );
}
