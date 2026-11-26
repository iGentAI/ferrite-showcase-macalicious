import { Label, type LabelColor } from "macalicious/label";

const colors: { color: LabelColor; use: string }[] = [
  { color: "primary", use: "Titles, form labels, body copy" },
  { color: "secondary", use: "Hints, subtitles, status lines" },
  { color: "tertiary", use: "Disabled text, group headers" },
  { color: "quaternary", use: "Watermark text" },
  { color: "text", use: "Opaque text, as in a document" },
  { color: "link", use: "Links" },
];

/** The system text colours, and the disabled look. */
export default function Colors() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "max-content max-content",
        gap: "6px 24px",
        alignItems: "baseline",
      }}
    >
      {colors.map(({ color, use }) => (
        <div key={color} style={{ display: "contents" }}>
          <Label color={color}>{color}</Label>
          <Label textStyle="small" color={color}>
            {use}
          </Label>
        </div>
      ))}
      <Label disabled>disabled</Label>
      <Label textStyle="small" disabled>
        Title of a disabled control
      </Label>
    </div>
  );
}
