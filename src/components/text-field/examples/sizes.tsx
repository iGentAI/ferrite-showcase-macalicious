import { TextField } from "macalicious/text-field";

export default function Sizes() {
  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
      <TextField aria-label="Regular" size="regular" defaultValue="Regular" />
      <TextField aria-label="Small" size="small" defaultValue="Small" />
      <TextField aria-label="Mini" size="mini" defaultValue="Mini" />
    </div>
  );
}
