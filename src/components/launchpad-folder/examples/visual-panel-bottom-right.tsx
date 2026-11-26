import { LaunchpadItem } from "macalicious/launchpad";
import { LaunchpadFolder } from "macalicious/launchpad-folder";
import { type CSSProperties, useState } from "react";

const APPS = Array.from({ length: 17 }, (_, index) => `App ${index + 1}`);

/**
 * Visual comparison target: the bottom right corner of the open folder "Other".
 *
 * Reference crop (2x pixels) x=2700 y=1380 w=440 h=280 of the Launchpad-Folder captures:
 * 220 x 140 pt at 1350,690 of the 1680 x 1050 pt screen. The folder holds seventeen apps, so
 * its third row ends after three of them and this part of the panel is empty: nothing in the
 * crop is Apple's artwork and nothing is masked.
 *
 * Behind the folder is Apple's desktop picture, blurred. The example does not have it, so it
 * paints what the captures show there: a vertical run from #244566 to #133551 (dark #122743
 * to #0e2037), measured beside the panel and continued under it. The panel's fill over it is
 * the folder's own. The folder's slight dimming of what is behind it is switched off, since
 * the painted background is the dimmed one already.
 */
export default function VisualPanelBottomRight() {
  const [desktop, setDesktop] = useState<HTMLDivElement | null>(null);
  return (
    <div style={{ position: "relative", width: 220, height: 140, overflow: "clip" }}>
      <div
        ref={setDesktop}
        style={
          {
            position: "absolute",
            left: -1350,
            top: -690,
            width: 1680,
            height: 1050,
            background:
              "linear-gradient(light-dark(#244566, #122743) 690px, light-dark(#133551, #0e2037) 830px)",
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
