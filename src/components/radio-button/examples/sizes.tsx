import { RadioButton, RadioGroup } from "macalicious/radio-button";

export default function Sizes() {
  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <RadioGroup key={size} orientation="horizontal" defaultValue="on" aria-label={size}>
          <RadioButton size={size} value="on">
            On
          </RadioButton>
          <RadioButton size={size} value="off">
            Off
          </RadioButton>
          <RadioButton size={size} value="disabled" disabled>
            Disabled
          </RadioButton>
        </RadioGroup>
      ))}
    </div>
  );
}
