import { Launchpad, LaunchpadItem } from "macalicious/launchpad";
import { useState } from "react";

/**
 * State check target: Launchpad over a flat mid grey, #808080, where the result of its scrim
 * can be computed: blur and saturation leave a flat grey as it is, and 44% of #1c1c1c over
 * it is #545454.
 *
 * One app, so that the keyboard has something to focus: its 112 pt icon box is at 103, 75.5,
 * and its stand-in icon, a #404040 square, fills the middle half of the box.
 */
export default function VisualScrim() {
  const [desktop, setDesktop] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setDesktop}
      style={{ position: "relative", width: 320, height: 400, background: "#808080" }}
    >
      <Launchpad open container={desktop} columns={1} rows={1}>
        <LaunchpadItem label="Notes">
          <span style={{ width: "50%", height: "50%", background: "#404040" }} />
        </LaunchpadItem>
      </Launchpad>
    </div>
  );
}
