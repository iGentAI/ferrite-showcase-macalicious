import { ACCENTS } from "macalicious/lib/appearance";
import { Slider } from "macalicious/slider";

/** The accent colour re-themes a subtree: set `data-accent` on any element. */
export default function Accents() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, width: 420 }}>
      {ACCENTS.map((accent) => (
        <span key={accent} data-accent={accent}>
          <Slider aria-label={accent} defaultValue={60} />
        </span>
      ))}
    </div>
  );
}
