import { RadioButton, RadioGroup } from "macalicious/radio-button";

/**
 * Visual comparison target: as visual-general, for the graphite accent in Dark Aqua. Graphite
 * switches off Catalina's wallpaper tinting, so the window background is the untinted #323232.
 */
export default function VisualGeneralGraphite() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 22,
        height: 44,
        padding: "3px 0 0 3px",
        overflow: "hidden",
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <RadioGroup defaultValue="automatic" aria-label="Show scroll bars" style={{ gap: 4 }}>
        <RadioButton value="automatic" aria-label="Automatically based on mouse or trackpad" />
        <RadioButton value="scrolling" aria-label="When scrolling" />
        <RadioButton value="always" aria-label="Always" />
      </RadioGroup>
    </div>
  );
}
