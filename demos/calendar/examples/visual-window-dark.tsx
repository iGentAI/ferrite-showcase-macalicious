import { type CSSProperties, useState } from "react";
import { Calendar } from "../calendar";
import { DARK_CAPTURE_NOW, darkCaptureEvents } from "../calendar-data";

/**
 * Visual comparison target: the Calendar window of the dark capture, taken a day after the
 * light one: Friday is today, its event is selected with its popover open, and Thursday's
 * event is not selected.
 *
 * The box is the region x=112 y=76 w=2620 h=1248 of the capture (1310 x 624 pt): the 1102 x
 * 624 pt frame and, right of it, the 208 pt that the popover and the window's shadow take, over
 * the capture's transparent margin (matte white). The comparisons capture two parts of it,
 * marked with `data-crop`: `window`, the frame left of the popover's arrow (978 pt), and
 * `popover`, the rest. As in `visual-window`, the popover is rendered into the box, kept on
 * the event's trailing side and given the opaque form of its material.
 */
export default function VisualWindowDark() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={
        {
          position: "relative",
          overflow: "hidden",
          width: 1310,
          height: 624,
          background: "#ffffff",
          "--mac-material-popover": "var(--mac-material-popover-opaque)",
        } as CSSProperties
      }
    >
      <Calendar
        events={darkCaptureEvents}
        now={DARK_CAPTURE_NOW}
        defaultSelectedEvent="more-screenshots"
        defaultPopoverOpen
        popoverProps={{ container: stage, collisionAvoidance: { side: "none", align: "none" } }}
        style={
          {
            position: "absolute",
            top: 0,
            left: 0,
            "--mac-calendar-week-grid-columns": "123px 124px 124px 124px 123px 123px 121px",
          } as CSSProperties
        }
      />
      <div
        data-crop="window"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 978,
          height: 624,
          pointerEvents: "none",
        }}
      />
      <div
        data-crop="popover"
        style={{
          position: "absolute",
          top: 0,
          left: 978,
          width: 332,
          height: 624,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
