import { LaunchpadItem } from "macalicious/launchpad";
import { LaunchpadFolder } from "macalicious/launchpad-folder";
import { type CSSProperties, useState } from "react";

const APPS = Array.from({ length: 17 }, (_, index) => `App ${index + 1}`);

/**
 * Visual comparison target: the top left corner of the open folder "Other".
 *
 * Reference crop (2x pixels) x=244 y=432 w=140 h=120 of the Launchpad-Folder captures:
 * 70 x 60 pt at 122,216 of the 1680 x 1050 pt screen; the panel's corner is at 137,231. The
 * crop ends before the first icon, so nothing is masked.
 *
 * As in `visual-panel-bottom-right`, the example paints the blurred desktop the captures
 * show there, #5683a7 to #6287a4 (dark #25456d to #315075), under the folder's own fill.
 */
export default function VisualPanelTopLeft() {
  const [desktop, setDesktop] = useState<HTMLDivElement | null>(null);
  return (
    <div style={{ position: "relative", width: 70, height: 60, overflow: "clip" }}>
      <div
        ref={setDesktop}
        style={
          {
            position: "absolute",
            left: -122,
            top: -216,
            width: 1680,
            height: 1050,
            background:
              "linear-gradient(light-dark(#5683a7, #25456d) 216px, light-dark(#6287a4, #315075) 276px)",
            "--mac-launchpad-folder-scrim": "transparent",
          } as CSSProperties
        }
      >
        <div style={{ width: 112 }}>
          <LaunchpadFolder label="Other" open container={desktop}>
            {APPS.map((name) => (
              <LaunchpadItem key={name} label={name} />
            ))}
          </LaunchpadFolder>
        </div>
      </div>
    </div>
  );
}
