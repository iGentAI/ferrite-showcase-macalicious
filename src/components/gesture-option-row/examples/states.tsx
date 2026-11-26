import { GestureOptionRow } from "macalicious/gesture-option-row";

/**
 * The highlight and the checkbox are independent: every combination, then a row without a
 * detail line and a disabled row.
 */
export default function States() {
  return (
    <div style={{ width: 311 }}>
      <GestureOptionRow
        title="Highlighted, on"
        detail="The preview shows this gesture"
        defaultChecked
        highlighted
      />
      <GestureOptionRow title="Highlighted, off" detail="Shown, but not enabled" highlighted />
      <GestureOptionRow title="On" detail="Enabled, not shown" defaultChecked />
      <GestureOptionRow title="Off" detail="Neither" />
      <GestureOptionRow title="Without a detail line" />
      <GestureOptionRow title="Disabled" detail="Needs a device that is not connected" disabled />
    </div>
  );
}
