import { Launchpad } from "macalicious/launchpad";
import { useState } from "react";

/**
 * Visual comparison target: Launchpad's search field.
 *
 * Reference crop (2x pixels) x=1400 y=30 w=560 h=90 of the Launchpad captures: 280 x 45 pt
 * around the field, which is 250 x 25 pt at 715,25 of the 1680 x 1050 pt screen.
 *
 * What is behind Launchpad there is Apple's desktop picture, blurred and dimmed. The example
 * does not have the picture, so it paints the crop's background as measured at its edges
 * (light #2c6ea4 to #3971a2, dark #0d2a55 to #08274e, corner to corner) and switches
 * Launchpad's own scrim off; the scrim is checked on its own in `visual-scrim`. The field's
 * fill, border, magnifier and placeholder are Launchpad's.
 *
 * The fallback font sets the placeholder 2.5 pt wider than San Francisco does, which moves
 * the magnifier beside it, so the example tightens the letter spacing; an application sets
 * none.
 */
export default function VisualSearch() {
  const [desktop, setDesktop] = useState<HTMLDivElement | null>(null);
  return (
    <div
      style={{
        position: "relative",
        width: 280,
        height: 45,
        overflow: "clip",
        background:
          "linear-gradient(to bottom right, light-dark(#2c6ea4, #0d2a55), light-dark(#3971a2, #08274e))",
      }}
    >
      <div
        ref={setDesktop}
        style={{ position: "absolute", left: -700, top: -15, width: 1680, height: 1050 }}
      >
        <Launchpad
          open
          container={desktop}
          style={{ background: "none", backdropFilter: "none", letterSpacing: "-0.4px" }}
        />
      </div>
    </div>
  );
}
