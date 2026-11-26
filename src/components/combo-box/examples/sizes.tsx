import { ComboBox, ComboBoxItem } from "macalicious/combo-box";

const SIZES = ["9", "10", "11", "12", "14", "18", "24"];

export default function Sizes() {
  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <ComboBox
          key={size}
          size={size}
          aria-label={`Font size, ${size}`}
          defaultValue="12"
          style={{ width: 80 }}
        >
          {SIZES.map((item) => (
            <ComboBoxItem key={item}>{item}</ComboBoxItem>
          ))}
        </ComboBox>
      ))}
    </div>
  );
}
