import { DatePicker } from "macalicious/date-picker";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

export default function Sizes() {
  return (
    <div style={{ display: "flex", gap: 28, alignItems: "end" }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <div key={size} style={{ display: "grid", gap: 6, justifyItems: "start" }}>
          <DatePicker
            size={size}
            aria-label={`A ${size} date picker`}
            elements="yearMonthDay"
            defaultValue={new Date(2019, 9, 3)}
          />
          <span style={caption}>{size}</span>
        </div>
      ))}
    </div>
  );
}
