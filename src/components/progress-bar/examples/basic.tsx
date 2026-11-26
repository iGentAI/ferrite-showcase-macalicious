import { ProgressBar } from "macalicious/progress-bar";
import { useId } from "react";

/** A determinate bar named by the text above it, with a status line below. */
export default function Basic() {
  const labelId = useId();
  return (
    <div style={{ width: 300 }}>
      <div id={labelId} style={{ marginBottom: 8, font: "var(--mac-font-body-emphasized)" }}>
        Backing Up: 12.4 GB of 19.3 GB
      </div>
      <ProgressBar value={64} aria-labelledby={labelId} />
      <div
        style={{
          marginTop: 6,
          font: "var(--mac-font-subheadline)",
          color: "var(--mac-color-label-secondary)",
        }}
      >
        About 4 minutes remaining
      </div>
    </div>
  );
}
