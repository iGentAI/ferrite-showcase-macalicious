import { Tooltip, TooltipPopup, TooltipTrigger } from "macalicious/tooltip";
import { useState } from "react";

/**
 * Fixture for the pixel checks in `tooltip.visual.json`: no screenshot shows a help tag, so
 * the checks hold an open tooltip to the values the spec infers.
 *
 * The tooltip is rendered inside this 200 x 60 pt box instead of the document body, so that it
 * is part of the capture. It opens under the 100 x 10 pt trigger without cursor tracking: its
 * border box starts at x 8, y 16 (6 pt below the trigger) and is 19 pt high (a 14 pt line,
 * 2 pt of padding and half a point of border above and below).
 */
export default function VisualOpen() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={{ position: "relative", width: 200, height: 60, overflow: "hidden" }}
    >
      <Tooltip defaultOpen trackCursorAxis="none">
        <TooltipTrigger
          aria-label="Share"
          style={{
            position: "absolute",
            left: 8,
            top: 0,
            width: 100,
            height: 10,
            padding: 0,
            border: 0,
            background: "none",
          }}
        />
        <TooltipPopup sideOffset={6} alignOffset={0} container={stage}>
          Share the selected items
        </TooltipPopup>
      </Tooltip>
    </div>
  );
}
