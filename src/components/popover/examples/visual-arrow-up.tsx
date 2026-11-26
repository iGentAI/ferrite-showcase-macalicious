import { Popover, PopoverPopup } from "macalicious/popover";
import { useState } from "react";

/**
 * Visual check target: a popover below its anchor, so that its arrow points up, on a 120 x 80
 * pt page (white in Aqua, #1e1e1e in Dark Aqua). The anchor ends 10 pt from the top; the arrow
 * spans y = 10 to 23, centred on x = 60, and the 100 x 40 pt panel starts at y = 23. No
 * screenshot shows a popover on this side: the checks read the arrow's fill, the page beside
 * its tip and the panel.
 */
export default function VisualArrowUp() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={{
        position: "relative",
        width: 120,
        height: 80,
        overflow: "hidden",
        background: "light-dark(#ffffff, #1e1e1e)",
      }}
    >
      <div
        ref={setAnchor}
        style={{ position: "absolute", top: 0, left: 50, width: 20, height: 10 }}
      />
      <Popover defaultOpen>
        <PopoverPopup
          aria-label="Event"
          side="bottom"
          anchor={anchor}
          container={stage}
          collisionAvoidance={{ side: "none", align: "none" }}
          style={{ width: 100, height: 40, padding: 0 }}
        />
      </Popover>
    </div>
  );
}
