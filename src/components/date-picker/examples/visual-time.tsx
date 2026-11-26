import { DatePicker } from "macalicious/date-picker";

/**
 * Visual comparison target: the enabled "From" time field of the Notifications preference
 * pane, with its stepper.
 *
 * Reference crop (2x pixels) x=814 y=540 w=174 h=56, that is 87 x 28 pt. The field's edge
 * runs x 819 to 948 (65 pt) and y 545 to 590 (23 pt): 2.5 pt from the crop's left and top
 * edges. The stepper's outline starts 4 pt after the field. The width is the screenshot's:
 * the field is as wide as its text, which is San Francisco there.
 */
export default function VisualTime() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 87,
        height: 28,
        padding: "2.5px 0 0 2.5px",
        lineHeight: 0,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <DatePicker
        aria-label="From"
        elements="hourMinute"
        defaultValue={new Date(2019, 9, 3, 22, 0)}
        style={{ width: 81.5 }}
      />
    </div>
  );
}
