import { DisclosureButton } from "macalicious/disclosure-button";

export default function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <DisclosureButton aria-label="Show details, regular" />
      <DisclosureButton size="small" aria-label="Show details, small" />
      <DisclosureButton size="mini" aria-label="Show details, mini" />
    </div>
  );
}
