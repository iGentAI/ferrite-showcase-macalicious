import { ComboBoxItem } from "macalicious/combo-box";
import { Toolbar } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarComboBox } from "macalicious/toolbar-combo-box";
import { useState } from "react";

const SIZES = [9, 10, 11, 12, 14, 18, 24, 36, 48, 64, 72];

/**
 * A font size control between the other items of a toolbar. The arrow keys move from item to
 * item and, inside the field, through its text; Down Arrow opens the list.
 */
export default function InToolbar() {
  const [size, setSize] = useState("12");
  const step = (by: number) => setSize((value) => String(Math.max(1, (Number(value) || 12) + by)));
  return (
    <Toolbar aria-label="Format" style={{ width: 240 }}>
      <ToolbarButton aria-label="Smaller" onClick={() => step(-1)}>
        −
      </ToolbarButton>
      <ToolbarComboBox aria-label="Font size" value={size} onValueChange={setSize}>
        {SIZES.map((item) => (
          <ComboBoxItem key={item}>{item}</ComboBoxItem>
        ))}
      </ToolbarComboBox>
      <ToolbarButton aria-label="Bigger" onClick={() => step(1)}>
        +
      </ToolbarButton>
    </Toolbar>
  );
}
