import { Separator } from "macalicious/separator";

/** In a flex row a vertical separator stretches to the height of the row. */
export default function Vertical() {
  return (
    <div style={{ display: "flex", gap: 12, height: 48, font: "var(--mac-font-body)" }}>
      <span style={{ alignSelf: "center" }}>Back Up Automatically</span>
      <Separator orientation="vertical" />
      <span style={{ alignSelf: "center" }}>Select Disk…</span>
    </div>
  );
}
