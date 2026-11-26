import { Slider } from "macalicious/slider";

/** Tick marks: a mark per stop, the thumb points at them, and the value can snap to them. */
export default function TickMarks() {
  return (
    <div style={{ display: "grid", gap: 16, width: 200 }}>
      <Slider aria-label="Size" tickMarks={2} defaultValue={40} />
      <Slider aria-label="Balance" tickMarks={5} defaultValue={50} />
      <Slider
        aria-label="Tracking speed"
        tickMarks={10}
        tickMarkValuesOnly
        max={9}
        defaultValue={3}
      />
      <Slider aria-label="Marks above" tickMarks={5} tickMarkPosition="above" defaultValue={25} />
    </div>
  );
}
