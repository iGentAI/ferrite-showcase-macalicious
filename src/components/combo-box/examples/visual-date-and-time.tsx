import { ComboBox, ComboBoxItem } from "macalicious/combo-box";

/**
 * The disabled combo box of System Preferences, Date & Time (crop 704,290,560,50): 275 pt
 * wide on the pane's box, whose fill is #e3e3e3 in Aqua and #363637 in Dark Aqua. The box is
 * 280 x 25 pt with the control's edge 2.5 pt inside it.
 */
export default function VisualDateAndTime() {
  return (
    <div
      style={{
        width: 280,
        height: 25,
        padding: 2.5,
        boxSizing: "border-box",
        lineHeight: 0,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <ComboBox
        aria-label="Time server"
        defaultValue="Apple Americas/U.S. (time.apple.com.)"
        disabled
        style={{ width: 275 }}
      >
        <ComboBoxItem>Apple Americas/U.S. (time.apple.com.)</ComboBoxItem>
      </ComboBox>
    </div>
  );
}
