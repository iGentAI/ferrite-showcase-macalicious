import { DatePicker } from "macalicious/date-picker";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;
const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const value = new Date(2019, 9, 3, 10, 56, 59);

/** The elements a field can show, and the field without its stepper. */
export default function Elements() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(2, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>yearMonthDay</span>
        <DatePicker aria-label="Date" elements="yearMonthDay" defaultValue={value} />
      </div>
      <div style={cell}>
        <span style={caption}>yearMonth</span>
        <DatePicker aria-label="Month" elements="yearMonth" defaultValue={value} />
      </div>
      <div style={cell}>
        <span style={caption}>hourMinute</span>
        <DatePicker aria-label="Time" elements="hourMinute" defaultValue={value} />
      </div>
      <div style={cell}>
        <span style={caption}>hourMinuteSecond</span>
        <DatePicker
          aria-label="Time with seconds"
          elements="hourMinuteSecond"
          defaultValue={value}
        />
      </div>
      <div style={cell}>
        <span style={caption}>yearMonthDay hourMinute</span>
        <DatePicker
          aria-label="Date and time"
          elements="yearMonthDay hourMinute"
          defaultValue={value}
        />
      </div>
      <div style={cell}>
        <span style={caption}>Without a stepper</span>
        <DatePicker
          aria-label="Date, field only"
          elements="yearMonthDay"
          defaultValue={value}
          stepper={false}
        />
      </div>
    </div>
  );
}
