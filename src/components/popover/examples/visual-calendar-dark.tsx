import { Popover, PopoverPopup, PopoverSeparator } from "macalicious/popover";
import { type CSSProperties, useState } from "react";

/**
 * Visual comparison target: the event popover of the Calendar capture, Dark Aqua. This box is
 * the region x=2046 y=464 w=680 h=450 px of the capture (340 x 225 pt); the comparisons
 * capture parts of it, marked with `data-crop`:
 *
 *   edge    the right edge with both corners, over the capture's transparent margin (matted
 *           white), where the dark outer line and the inner rim show
 *   arrow   the arrow over the dark day column
 *
 * The panel is 289 x 182 pt at 26, 20 (the event's title takes two lines) and the arrow's
 * centre is 91 pt below its top. The Calendar window ends 135 pt from the left of this box;
 * the grid behind the arrow is #252626.
 *
 * A window capture records the popover's material already blended with what was behind it on
 * the desktop, which the capture does not contain: the fill is #282828 also where the popover
 * lies over the transparent margin. The example therefore uses the opaque form of the material;
 * over this box's white matte the translucent one would come out lighter than the capture.
 * The three lines are `PopoverSeparator`s, #4b4b4b in the capture.
 */
export default function VisualCalendarDark() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={
        {
          position: "relative",
          width: 340,
          height: 225,
          overflow: "hidden",
          background: "linear-gradient(to right, #252626 135px, white 135px)",
          "--mac-material-popover": "var(--mac-material-popover-opaque)",
        } as CSSProperties
      }
    >
      <div
        ref={setAnchor}
        style={{ position: "absolute", top: 106, left: 0, width: 13, height: 10 }}
      />
      <div
        data-crop="edge"
        style={{ position: "absolute", top: 5, left: 265, width: 70, height: 215 }}
      />
      <div
        data-crop="arrow"
        style={{ position: "absolute", top: 92, left: 13, width: 20, height: 36 }}
      />
      <Popover defaultOpen>
        <PopoverPopup
          aria-label="Event"
          side="right"
          align="start"
          alignOffset={-86}
          anchor={anchor}
          container={stage}
          collisionAvoidance={{ side: "none", align: "none" }}
          style={{ width: 289, height: 182, padding: 0 }}
        >
          <div style={{ height: 80 }} />
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
