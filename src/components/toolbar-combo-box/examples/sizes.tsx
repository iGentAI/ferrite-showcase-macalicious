import { ComboBoxItem } from "macalicious/combo-box";
import { ToolbarComboBox, type ToolbarComboBoxProps } from "macalicious/toolbar-combo-box";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

function FontSize(props: ToolbarComboBoxProps) {
  return (
    <ToolbarComboBox aria-label="Font size" defaultValue="12" {...props}>
      <ComboBoxItem>9</ComboBoxItem>
      <ComboBoxItem>12</ComboBoxItem>
      <ComboBoxItem>18</ComboBoxItem>
    </ToolbarComboBox>
  );
}

/** The two sizes: the one of a toolbar and the one of a format bar. */
export default function Sizes() {
  return (
    <div style={{ display: "flex", gap: 28, alignItems: "end" }}>
      <div style={cell}>
        <span style={caption}>Regular</span>
        <FontSize />
      </div>
      <div style={cell}>
        <span style={caption}>Small</span>
        <FontSize size="small" />
      </div>
    </div>
  );
}
