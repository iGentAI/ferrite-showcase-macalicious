import { ACCENTS } from "macalicious/lib/appearance";
import { PushButton } from "macalicious/push-button";

/** The accent colour re-themes a subtree: set `data-accent` on any element. */
export default function Accents() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {ACCENTS.map((accent) => (
        <span key={accent} data-accent={accent}>
          <PushButton variant="primary" style={{ textTransform: "capitalize" }}>
            {accent}
          </PushButton>
        </span>
      ))}
    </div>
  );
}
