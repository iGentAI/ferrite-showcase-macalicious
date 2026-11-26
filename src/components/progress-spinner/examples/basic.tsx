import { ProgressSpinner } from "macalicious/progress-spinner";
import { useId } from "react";

/** A small spinner named by the text beside it, which says what is under way. */
export default function Basic() {
  const labelId = useId();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, font: "var(--mac-font-body)" }}>
      <ProgressSpinner size="small" aria-labelledby={labelId} />
      <span id={labelId}>Checking for updates…</span>
    </div>
  );
}
