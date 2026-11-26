import { DatePicker, DatePickerCalendar } from "macalicious/date-picker";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;
const cell = { display: "grid", gap: 6, justifyItems: "start", alignContent: "start" } as const;
const value = new Date(2019, 9, 3, 10, 56, 59);

/**
 * Every state side by side. A selected element is transient, so this gallery pins it with
 * the `data-force` preview attribute; in an application it comes from the keyboard focus,
 * which also draws the focus ring around the field.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(4, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <DatePicker aria-label="Normal" elements="yearMonthDay" defaultValue={value} />
      </div>
      <div style={cell}>
        <span style={caption}>Element selected</span>
        <DatePicker
          aria-label="Element selected"
          elements="yearMonthDay"
          defaultValue={value}
          data-force="focus"
        />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <DatePicker aria-label="Disabled" elements="yearMonthDay" defaultValue={value} disabled />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window, selected</span>
        <DatePicker
          aria-label="Inactive window, element selected"
          elements="yearMonthDay"
          defaultValue={value}
          data-force="focus"
        />
      </div>
      <div style={cell}>
        <span style={caption}>Calendar</span>
        <DatePickerCalendar aria-label="Calendar" defaultValue={value} />
      </div>
      <div style={cell}>
        <span style={caption}>Calendar, disabled</span>
        <DatePickerCalendar aria-label="Calendar, disabled" defaultValue={value} disabled />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Calendar, inactive window</span>
        <DatePickerCalendar aria-label="Calendar, inactive window" defaultValue={value} />
      </div>
    </div>
  );
}
