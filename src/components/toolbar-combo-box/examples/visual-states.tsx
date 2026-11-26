import { ComboBoxItem } from "macalicious/combo-box";
import { ToolbarComboBox, type ToolbarComboBoxProps } from "macalicious/toolbar-combo-box";

function FontSize(props: ToolbarComboBoxProps) {
  return (
    <ToolbarComboBox defaultValue="12" {...props}>
      <ComboBoxItem>9</ComboBoxItem>
      <ComboBoxItem>12</ComboBoxItem>
    </ToolbarComboBox>
  );
}

/**
 * Target of the pixel checks of the regular size and of the states no screenshot shows: at
 * rest, the button pressed, and disabled, each 60 x 22 pt, 8 pt apart and 4 pt inside a
 * 204 x 30 pt box of the format bar's colour at mid-height.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        boxSizing: "border-box",
        width: 204,
        height: 30,
        padding: 4,
        lineHeight: 0,
        background: "light-dark(#d3d3d3, #3a3d3f)",
      }}
    >
      <FontSize aria-label="At rest" />
      <FontSize aria-label="Pressed" data-force="pressed" />
      <FontSize aria-label="Disabled" disabled />
    </div>
  );
}
