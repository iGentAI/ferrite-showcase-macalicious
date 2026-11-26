import { Separator } from "macalicious/separator";

/** Two groups of settings divided by a separator, with the section spacing above and below. */
export default function Basic() {
  return (
    <div style={{ width: 320, font: "var(--mac-font-body)" }}>
      <div>Require password after sleep or screen saver begins</div>
      <Separator style={{ marginBlock: "var(--mac-space-section)" }} />
      <div>Allow apps downloaded from:</div>
    </div>
  );
}
