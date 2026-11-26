import { GestureOptionRow } from "macalicious/gesture-option-row";
import { useState } from "react";

const GESTURES = [
  {
    id: "scroll",
    title: "Scroll direction: Natural",
    detail: "Content tracks finger movement",
    on: true,
  },
  { id: "secondary", title: "Secondary click", detail: "Click on right side", on: false },
  { id: "zoom", title: "Smart zoom", detail: "Double-tap with one finger", on: false },
];

/**
 * A list of gestures beside a preview, as in the Mouse pane. The highlight follows the pointer
 * and keyboard focus and stays on the last row either reached; the preview describes that row.
 * A real pane shows a still or a film there.
 */
export default function Preview() {
  const [shown, setShown] = useState("scroll");
  const gesture = GESTURES.find((item) => item.id === shown);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 35 }}>
      <div style={{ width: 311 }}>
        {GESTURES.map((item) => (
          <GestureOptionRow
            key={item.id}
            title={item.title}
            detail={item.detail}
            defaultChecked={item.on}
            highlighted={item.id === shown}
            onPointerEnter={() => setShown(item.id)}
            onFocus={() => setShown(item.id)}
          />
        ))}
      </div>
      <div
        aria-live="polite"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          width: 180,
          height: 120,
          padding: 12,
          border: "1px solid var(--mac-color-separator)",
          borderRadius: 4,
          color: "var(--mac-color-label-secondary)",
          font: "var(--mac-font-subheadline)",
          textAlign: "center",
        }}
      >
        Preview: {gesture?.title}
      </div>
    </div>
  );
}
