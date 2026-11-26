import { TextField } from "macalicious/text-field";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/** The bezel styles. The square and the capsule bezel appear in the reference screenshots. */
export default function Bezels() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "max-content 200px",
        gap: "10px 12px",
        alignItems: "center",
      }}
    >
      <span style={caption}>Square</span>
      <TextField aria-label="Square bezel" defaultValue="Square bezel" style={{ width: "100%" }} />
      <span style={caption}>Rounded</span>
      <TextField
        aria-label="Rounded bezel"
        bezel="rounded"
        defaultValue="Rounded bezel"
        style={{ width: "100%" }}
      />
      <span style={caption}>Capsule</span>
      <TextField
        aria-label="Capsule bezel"
        bezel="capsule"
        placeholder="iMessage"
        style={{ width: "100%" }}
      />
      <span style={caption}>None</span>
      <TextField
        aria-label="No bezel"
        bezel="none"
        defaultValue="No bezel"
        style={{ width: "100%" }}
      />
    </div>
  );
}
