import { ComboBoxItem } from "macalicious/combo-box";
import { ToolbarComboBox, type ToolbarComboBoxProps } from "macalicious/toolbar-combo-box";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

function FontSize(props: ToolbarComboBoxProps) {
  return (
    <ToolbarComboBox defaultValue="12" {...props}>
      <ComboBoxItem>9</ComboBoxItem>
      <ComboBoxItem>12</ComboBoxItem>
      <ComboBoxItem>18</ComboBoxItem>
    </ToolbarComboBox>
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
        <FontSize aria-label="Normal" />
      </div>
      <div style={cell}>
        <span style={caption}>Focused</span>
        <FontSize aria-label="Focused" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Button pressed, or list open</span>
        <FontSize aria-label="Pressed" data-force="pressed" />
      </div>
      <div style={cell}>
        <span style={caption}>Placeholder</span>
        <FontSize aria-label="Placeholder" defaultValue="" placeholder="Size" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <FontSize aria-label="Disabled" disabled />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <FontSize aria-label="Inactive window" />
      </div>
    </div>
  );
}
