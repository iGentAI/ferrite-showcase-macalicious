import { Stepper } from "macalicious/stepper";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

export default function Sizes() {
  return (
    <div style={{ display: "flex", gap: 28, alignItems: "end" }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <div key={size} style={{ display: "grid", gap: 6, justifyItems: "center" }}>
          <Stepper size={size} aria-label={`A ${size} stepper`} />
          <span style={caption}>{size}</span>
        </div>
      ))}
    </div>
  );
}
