import { Slider } from "macalicious/slider";

export default function Sizes() {
  return (
    <div style={{ display: "grid", gap: 12, width: 260 }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <div key={size} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Slider size={size} aria-label={size} defaultValue={60} />
          <Slider size={size} aria-label={`${size}, tick marks`} tickMarks={5} defaultValue={50} />
        </div>
      ))}
    </div>
  );
}
