import { Slider } from "macalicious/slider";

/** A vertical slider needs a height: its own, or that of the element it fills. */
export default function Vertical() {
  return (
    <div style={{ display: "flex", gap: 24, height: 120 }}>
      <Slider aria-label="Volume" orientation="vertical" defaultValue={60} />
      <Slider aria-label="Bass" orientation="vertical" tickMarks={5} defaultValue={50} />
      <Slider
        aria-label="Treble"
        orientation="vertical"
        tickMarks={5}
        tickMarkPosition="leading"
        defaultValue={75}
      />
    </div>
  );
}
