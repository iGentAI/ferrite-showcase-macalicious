import { ComboBox, ComboBoxItem } from "macalicious/combo-box";
import { useState } from "react";

/**
 * Fixture for the open list, which no reference screenshot shows. The list is rendered into
 * the stage, so it is inside the capture: 180 x 110 pt on the window background, the control
 * at x 10 to 170 and y 10 to 30, the list 3 pt below it, x 10 to 170 from y 33, with three
 * 18 pt rows from y 37. The comparison hovers the second row.
 */
export default function VisualOpen() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={{
        position: "relative",
        width: 180,
        height: 110,
        padding: 10,
        boxSizing: "border-box",
        overflow: "hidden",
        lineHeight: 0,
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <ComboBox aria-label="Size" defaultOpen container={stage} style={{ width: 160 }}>
        <ComboBoxItem>Small</ComboBoxItem>
        <ComboBoxItem data-testid="second">Medium</ComboBoxItem>
        <ComboBoxItem>Large</ComboBoxItem>
      </ComboBox>
    </div>
  );
}
