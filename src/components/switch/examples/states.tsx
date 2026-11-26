import { Switch } from "macalicious/switch";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Every state side by side, off above on. Pressed and focused are transient, so this gallery
 * pins them with the `data-force` preview attribute; in an application they come from :active
 * and :focus-visible.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <Switch aria-label="Off" />
        <Switch aria-label="On" defaultChecked />
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <Switch aria-label="Off, pressed" data-force="pressed" />
        <Switch aria-label="On, pressed" defaultChecked data-force="pressed" />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <Switch aria-label="Off, focused" data-force="focus" />
        <Switch aria-label="On, focused" defaultChecked data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <Switch aria-label="Off, disabled" disabled />
        <Switch aria-label="On, disabled" defaultChecked disabled />
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window, not key</span>
        <Switch aria-label="Off, main window" />
        <Switch aria-label="On, main window" defaultChecked />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <Switch aria-label="Off, inactive window" />
        <Switch aria-label="On, inactive window" defaultChecked />
      </div>
    </div>
  );
}
