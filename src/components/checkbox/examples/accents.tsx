import { Checkbox } from "macalicious/checkbox";
import { ACCENTS } from "macalicious/lib/appearance";

/** The accent colour re-themes a subtree: set `data-accent` on any element. */
export default function Accents() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
      {ACCENTS.map((accent) => (
        <span key={accent} data-accent={accent} style={{ display: "inline-flex", gap: 6 }}>
          <Checkbox indeterminate aria-label={`${accent}, mixed`} />
          <Checkbox defaultChecked style={{ textTransform: "capitalize" }}>
            {accent}
          </Checkbox>
        </span>
      ))}
    </div>
  );
}
