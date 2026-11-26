import { LevelIndicator } from "macalicious/level-indicator";
import { useId } from "react";

/** A continuous capacity indicator beside its label, with tick marks. */
export default function Basic() {
  const labelId = useId();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "max-content 200px",
        gap: 8,
        alignItems: "start",
        font: "var(--mac-font-body)",
      }}
    >
      <span id={labelId}>Input level:</span>
      <LevelIndicator value={62} tickMarks={11} aria-labelledby={labelId} />
    </div>
  );
}
