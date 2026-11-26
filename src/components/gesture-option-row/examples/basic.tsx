import { GestureOptionRow } from "macalicious/gesture-option-row";

export default function Basic() {
  return (
    <div style={{ width: 311 }}>
      <GestureOptionRow
        title="Scroll direction: Natural"
        detail="Content tracks finger movement"
        defaultChecked
        highlighted
      />
    </div>
  );
}
