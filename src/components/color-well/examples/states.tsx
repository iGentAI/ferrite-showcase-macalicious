import { ColorWell } from "macalicious/color-well";

const cell = { display: "grid", gap: 6, justifyItems: "start", alignContent: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Every state side by side, in both bezel styles. Keyboard focus is transient, so this gallery
 * pins it with the `data-force` preview attribute; the active look is the `active` prop.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <ColorWell aria-label="Normal" defaultValue="#ff9500" />
        <ColorWell aria-label="Normal, toolbar" variant="toolbar" defaultValue="#ff9500" />
      </div>
      <div style={cell}>
        <span style={caption}>Active</span>
        <ColorWell aria-label="Active" active defaultValue="#ff9500" />
        <ColorWell aria-label="Active, toolbar" variant="toolbar" active defaultValue="#ff9500" />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <ColorWell aria-label="Focused" data-force="focus" defaultValue="#ff9500" />
        <ColorWell
          aria-label="Focused, toolbar"
          variant="toolbar"
          data-force="focus"
          defaultValue="#ff9500"
        />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <ColorWell aria-label="Disabled" disabled defaultValue="#ff9500" />
        <ColorWell
          aria-label="Disabled, toolbar"
          variant="toolbar"
          disabled
          defaultValue="#ff9500"
        />
      </div>
      <div style={cell}>
        <span style={caption}>Without a bezel</span>
        <ColorWell aria-label="Without a bezel" bordered={false} defaultValue="#ff9500" />
        <ColorWell
          aria-label="Without a bezel, toolbar"
          variant="toolbar"
          bordered={false}
          defaultValue="#ff9500"
        />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window, focused</span>
        <ColorWell aria-label="Inactive window" data-force="focus" defaultValue="#ff9500" />
        <ColorWell
          aria-label="Inactive window, toolbar"
          variant="toolbar"
          data-force="focus"
          defaultValue="#ff9500"
        />
      </div>
    </div>
  );
}
