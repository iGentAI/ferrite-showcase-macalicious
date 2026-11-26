import { ColorWell } from "macalicious/color-well";

export default function Basic() {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the colour well renders the labelled input
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        font: "var(--mac-font-control-regular)",
        color: "var(--mac-color-label)",
      }}
    >
      Text colour:
      <ColorWell defaultValue="#0a84ff" />
    </label>
  );
}
