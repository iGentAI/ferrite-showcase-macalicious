import { ColorWheel } from "macalicious/color-wheel";

const cell = { display: "grid", gap: 6, alignContent: "start", width: 110 } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * The states side by side. Keyboard focus is transient, so this gallery cannot pin it on the
 * area from outside; Tab into a wheel to see the ring.
 */
export default function States() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 28px" }}>
      <div style={cell}>
        <span style={caption}>Normal</span>
        <ColorWheel defaultValue="#ff9300" />
      </div>
      <div style={cell}>
        <span style={caption}>Half brightness</span>
        <ColorWheel defaultValue="#804a00" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <ColorWheel disabled defaultValue="#ff9300" />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <ColorWheel defaultValue="#ff9300" />
      </div>
    </div>
  );
}
