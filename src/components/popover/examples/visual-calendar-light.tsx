import { Popover, PopoverPopup, PopoverSeparator } from "macalicious/popover";
import { useState } from "react";

/**
 * Visual comparison target: the event popover of the Calendar capture, Aqua, with its arrow on
 * the left edge. This box is the region x=1800 y=789 w=680 h=410 px of the capture (340 x 205
 * pt); the comparisons capture parts of it, marked with `data-crop`:
 *
 *   edge    the right edge with both corners, where the popover lies outside the Calendar
 *           window, over the capture's transparent margin (matted white)
 *   arrow   the arrow over the white day column, next to the event block it points at
 *
 * The panel is 289 x 162 pt at 26, 19.5 and the arrow's centre is 81 pt below its top. The
 * event's text and its pop-up button are Calendar's content and are left out; the three
 * separators are `PopoverSeparator`s where the capture has them. The column line of the
 * Calendar grid under the arrow's tip is drawn at x = 13.
 */
export default function VisualCalendarLight() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={{
        position: "relative",
        width: 340,
        height: 205,
        overflow: "hidden",
        background: "white",
      }}
    >
      <div
        style={{ position: "absolute", inset: "0 auto 0 13px", width: 1, background: "#e3e3e3" }}
      />
      <div
        ref={setAnchor}
        style={{ position: "absolute", top: 95.5, left: 0, width: 13, height: 10 }}
      />
      <div
        data-crop="edge"
        style={{ position: "absolute", top: 5, left: 265, width: 70, height: 195 }}
      />
      <div
        data-crop="arrow"
        style={{ position: "absolute", top: 87, left: 12, width: 20, height: 36 }}
      />
      <Popover defaultOpen>
        <PopoverPopup
          aria-label="Event"
          side="right"
          align="start"
          alignOffset={-76}
          anchor={anchor}
          container={stage}
          collisionAvoidance={{ side: "none", align: "none" }}
          style={{ width: 289, height: 162, padding: 0 }}
        >
          <div style={{ height: 60 }} />
          <PopoverSeparator aria-hidden="true" />
          <div style={{ height: 34 }} />
          <PopoverSeparator aria-hidden="true" />
          <div style={{ height: 28 }} />
          <PopoverSeparator aria-hidden="true" />
        </PopoverPopup>
      </Popover>
    </div>
  );
}
