import { RoundRectButton } from "macalicious/round-rect-button";
import { SystemImage } from "macalicious/system-image";

/**
 * Every state side by side. Pressed and keyboard focus are transient, so this gallery pins
 * them with the `data-force` preview attribute.
 */
export default function States() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <RoundRectButton>Normal</RoundRectButton>
      <RoundRectButton data-force="pressed">Pressed</RoundRectButton>
      <RoundRectButton data-force="focus">Focused</RoundRectButton>
      <RoundRectButton disabled>Disabled</RoundRectButton>
      <RoundRectButton aria-label="Add" style={{ padding: 0 }}>
        <SystemImage name="add" scale={8 / 11} />
      </RoundRectButton>
    </div>
  );
}
