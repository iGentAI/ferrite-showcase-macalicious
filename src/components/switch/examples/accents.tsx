import { ACCENTS } from "macalicious/lib/appearance";
import { Switch } from "macalicious/switch";

/** The accent colour re-themes a subtree: set `data-accent` on any element. */
export default function Accents() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {ACCENTS.map((accent) => (
        <span key={accent} data-accent={accent}>
          <Switch aria-label={accent} defaultChecked />
        </span>
      ))}
    </div>
  );
}
