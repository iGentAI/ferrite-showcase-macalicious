import { DatePicker } from "macalicious/date-picker";

/**
 * Fixture for the control sizes, of which the screenshots show the regular one only.
 *
 * 98 x 92 pt: three pickers of 82 pt, 8 pt apart and 8 pt from every side. The fields are
 * 23, 20 and 17 pt high: y 8 to 31, 39 to 59 and 67 to 84.
 */
export default function VisualSizes() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "grid",
        gap: 8,
        width: 98,
        padding: 8,
        lineHeight: 0,
        background: "light-dark(#ececec, #2f3032)",
      }}
    >
      {(["regular", "small", "mini"] as const).map((size) => (
        <DatePicker
          key={size}
          size={size}
          aria-label={`A ${size} time`}
          elements="hourMinute"
          defaultValue={new Date(2019, 9, 3, 22, 0)}
          style={{ width: 82 }}
        />
      ))}
    </div>
  );
}
