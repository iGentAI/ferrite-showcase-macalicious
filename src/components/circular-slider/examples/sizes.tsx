import { CircularSlider } from "macalicious/circular-slider";

export default function Sizes() {
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <div key={size} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <CircularSlider size={size} aria-label={size} defaultValue={15} />
          <CircularSlider
            size={size}
            aria-label={`${size}, tick marks`}
            tickMarks={12}
            defaultValue={50}
          />
          <CircularSlider size={size} aria-label={`${size}, disabled`} defaultValue={75} disabled />
        </div>
      ))}
    </div>
  );
}
