import { ColorPalette } from "macalicious/color-palette";

const cell = { display: "grid", gap: 6, alignContent: "start", width: 150 } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;
const colors = [
  ["Red", "#ff0000"],
  ["Green", "#00ff00"],
  ["Blue", "#0000ff"],
] as const;

/** The states of the list side by side. */
export default function States() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 28px" }}>
      <div style={cell}>
        <span style={caption}>Chosen</span>
        <ColorPalette aria-label="Chosen" colors={colors} defaultValue="#00ff00" />
      </div>
      <div style={cell}>
        <span style={caption}>Nothing chosen</span>
        <ColorPalette aria-label="Nothing chosen" colors={colors} />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <ColorPalette aria-label="Disabled" colors={colors} defaultValue="#00ff00" disabled />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <ColorPalette aria-label="Inactive window" colors={colors} defaultValue="#00ff00" />
      </div>
    </div>
  );
}
