import { Ruler, type RulerProps } from "macalicious/ruler";

const caption = {
  margin: "0 0 4px",
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

function Sample({ units }: Pick<RulerProps, "units">) {
  return (
    <div>
      <p style={caption}>{units}</p>
      <Ruler units={units} style={{ width: 400 }} />
    </div>
  );
}

/** The four measurement units. Only inches appear in the reference screenshots. */
export default function Units() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Sample units="inches" />
      <Sample units="centimeters" />
      <Sample units="points" />
      <Sample units="picas" />
    </div>
  );
}
