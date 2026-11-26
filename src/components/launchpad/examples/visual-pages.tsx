import { Launchpad, LaunchpadItem } from "macalicious/launchpad";
import { useState } from "react";

const APPS = Array.from({ length: 36 }, (_, index) => `App ${index + 1}`);

/**
 * Visual comparison target: Launchpad's page dots, two pages with the first current.
 *
 * Reference crop (2x pixels) x=1620 y=1810 w=120 h=52 of the Launchpad captures: 60 x 26 pt
 * around the two dots, whose centres are at 828.75 and 848.75, 918 of the 1680 x 1050 pt
 * screen, 52 pt above the Dock.
 *
 * Thirty-six apps on the 7 by 5 grid make the two pages. As in `visual-search`, the example
 * paints the crop's background as measured (light #1c2c3a to #0c2436, dark #111d2e to
 * #0e1b2a, corner to corner) in place of the blurred desktop picture, and switches
 * Launchpad's scrim off.
 */
export default function VisualPages() {
  const [desktop, setDesktop] = useState<HTMLDivElement | null>(null);
  return (
    <div
      style={{
        position: "relative",
        width: 60,
        height: 26,
        overflow: "clip",
        background:
          "linear-gradient(to bottom right, light-dark(#1c2c3a, #111d2e), light-dark(#0c2436, #0e1b2a))",
      }}
    >
      <div
        ref={setDesktop}
        style={{ position: "absolute", left: -810, top: -905, width: 1680, height: 1050 }}
      >
        <Launchpad open container={desktop} style={{ background: "none", backdropFilter: "none" }}>
          {APPS.map((name) => (
            <LaunchpadItem key={name} label={name} />
          ))}
        </Launchpad>
      </div>
    </div>
  );
}
