import { ComboBox, ComboBoxItem, type ComboBoxProps } from "macalicious/combo-box";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

function Server(props: ComboBoxProps) {
  return (
    <ComboBox defaultValue="time.apple.com" style={{ width: 150 }} {...props}>
      <ComboBoxItem>time.apple.com</ComboBoxItem>
      <ComboBoxItem>time.asia.apple.com</ComboBoxItem>
      <ComboBoxItem>time.euro.apple.com</ComboBoxItem>
    </ComboBox>
  );
}

/**
 * Every state side by side. Focus and a pressed button are transient, so this gallery pins
 * them with the `data-force` preview attribute; in an application they come from the keyboard
 * focus and from the pointer.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <Server aria-label="Normal" />
      </div>
      <div style={cell}>
        <span style={caption}>Focused</span>
        <Server aria-label="Focused" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Button pressed, or list open</span>
        <Server aria-label="Pressed" data-force="pressed" />
      </div>
      <div style={cell}>
        <span style={caption}>Placeholder</span>
        <Server aria-label="Placeholder" defaultValue="" placeholder="Server" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <Server aria-label="Disabled" disabled />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window, focused</span>
        <Server aria-label="Inactive window" data-force="focus" />
      </div>
    </div>
  );
}
