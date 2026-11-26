import { DefaultButton } from "macalicious/default-button";
import { ACCENTS } from "macalicious/lib/appearance";

/** The eight Catalina accents. `data-accent` on any ancestor re-colours the bezel. */
export default function Accents() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {ACCENTS.map((accent) => (
        <span key={accent} data-accent={accent}>
          <DefaultButton>{accent[0]?.toUpperCase() + accent.slice(1)}</DefaultButton>
        </span>
      ))}
    </div>
  );
}
