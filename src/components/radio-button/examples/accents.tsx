import { ACCENTS } from "macalicious/lib/appearance";
import { RadioButton, RadioGroup } from "macalicious/radio-button";

/** The accent colour re-themes a subtree: set `data-accent` on any element. */
export default function Accents() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
      {ACCENTS.map((accent) => (
        <RadioGroup
          key={accent}
          data-accent={accent}
          orientation="horizontal"
          defaultValue="on"
          aria-label={accent}
        >
          <RadioButton value="on" style={{ textTransform: "capitalize" }}>
            {accent}
          </RadioButton>
        </RadioGroup>
      ))}
    </div>
  );
}
