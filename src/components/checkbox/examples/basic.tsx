import { Checkbox } from "macalicious/checkbox";

export default function Basic() {
  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <Checkbox defaultChecked>Show Bluetooth in menu bar</Checkbox>
      <Checkbox>Ask to keep changes when closing documents</Checkbox>
      <Checkbox indeterminate>Install app updates</Checkbox>
    </div>
  );
}
