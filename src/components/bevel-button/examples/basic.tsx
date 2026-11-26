import { BevelButton } from "macalicious/bevel-button";

export default function Basic() {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <BevelButton>Grid</BevelButton>
      <BevelButton defaultPressed>Snap</BevelButton>
    </div>
  );
}
