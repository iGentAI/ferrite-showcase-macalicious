import { type CSSProperties, useState } from "react";
import { Calendar } from "../calendar";

/**
 * Visual comparison target: the Calendar window of the light capture, in the week of
 * 29 September 2019 with Thursday's event selected and its popover open, which reaches beyond
 * the window's trailing edge.
 *
 * The box is the region x=112 y=76 w=2370 h=1248 of the capture (1185 x 624 pt): the 1102 x
 * 624 pt frame and, right of it, the 83 pt that the popover and the window's shadow take, over
 * the capture's transparent margin (matte white). The comparisons capture two parts of it,
 * marked with `data-crop`: `window`, the frame left of the popover's arrow (856 pt), and
 * `popover`, the rest.
 *
 * The popover is rendered into the box and kept on the event's trailing side, whatever room
 * the page has. A window capture records the popover's material already blended with what was
 * behind it on screen, so the box gives it the opaque form of the material. At this width
 * AppKit rounds the seven day columns to 123, 124, 124, 124, 123, 123 and 121 pt, which the
 * week grid's columns hook reproduces.
 */
export default function VisualWindow() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={
        {
          position: "relative",
          overflow: "hidden",
          width: 1185,
          height: 624,
          background: "#ffffff",
          "--mac-material-popover": "var(--mac-material-popover-opaque)",
        } as CSSProperties
      }
    >
      <Calendar
        defaultSelectedEvent="screenshots"
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
          width: 856,
          height: 624,
          pointerEvents: "none",
        }}
      />
      <div
        data-crop="popover"
        style={{
          position: "absolute",
          top: 0,
          left: 856,
          width: 329,
          height: 624,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
