import { MissionControl, MissionControlSpace } from "macalicious/mission-control";
import { type CSSProperties, useState } from "react";

const SPACES = ["Desktop 1", "Desktop 2", "Notes & Safari", "Photos"];

// The Spaces bar as the Dark Aqua capture shows it: its top row, its bottom row, how much of
// the top row is left at each height, and the picture in the point under the bar.
const TOP =
  "linear-gradient(to right, #27446e 0px, #24426c 120px, #24416c 240px, #213f6a 360px, #1f3c66 480px, #1c3963 600px, #19365e 720px, #14335a 840px, #132f54 960px, #132c52 1080px, #11294e 1200px, #0e294c 1320px, #0e264a 1440px, #0d2445 1560px, #0c2343 1680px)";
const BOTTOM =
  "linear-gradient(to right, #2c4a72 0px, #28456e 120px, #25406b 240px, #24426c 360px, #24416c 480px, #23406a 600px, #213f69 720px, #1f3c65 840px, #1c365f 960px, #19365d 1080px, #16335a 1200px, #133158 1320px, #102e53 1440px, #0f2a4f 1560px, #0d2749 1680px)";
const FADE = "linear-gradient(rgb(0 0 0 / 1) 28px, rgb(0 0 0 / 0) 132px)";
const BELOW =
  "linear-gradient(to right, #3a5882 0px, #2e4a73 120px, #294771 240px, #294772 360px, #2a4873 480px, #2a4772 600px, #294671 720px, #274470 840px, #1e3963 960px, #1c3861 1080px, #18365f 1200px, #13315a 1320px, #0d2a51 1440px, #0a254d 1560px, #041f45 1680px)";

const layer: CSSProperties = { position: "absolute", top: 0, left: 0, width: 1680, height: 146 };

/**
 * Visual comparison target: the Spaces bar, Dark Aqua, with the first space current.
 *
 * Reference crop (2x pixels) x=0 y=0 w=3360 h=296 of the dark Mission Control capture: the
 * top 1680 x 148 pt of the screen, the 146 pt bar and 2 pt of the desktop under it.
 *
 * As in `visual-bar-light`, the example paints the bar as captured, and the strip of Apple's
 * desktop picture under it, and switches the bar's own tint and blur off; the thumbnails are
 * plain stand-ins that the comparison masks. The capture has a different space current than
 * the light one, which is why there are two examples.
 */
export default function VisualBarDark() {
  const [desktop, setDesktop] = useState<HTMLDivElement | null>(null);
  return (
    <div style={{ position: "relative", width: 1680, height: 148, overflow: "clip" }}>
      <div style={{ ...layer, height: 148, background: BELOW }} />
      <div style={{ ...layer, background: BOTTOM }} />
      <div style={{ ...layer, background: TOP, maskImage: FADE }} />
      <div
        ref={setDesktop}
        style={
          {
            ...layer,
            height: 1050,
            "--mac-mission-control-desktop": "transparent",
            "--mac-mission-control-bar-fill": "transparent",
            "--mac-mission-control-bar-filter": "none",
          } as CSSProperties
        }
      >
        <MissionControl
          open
          container={desktop}
          onAddSpace={() => {}}
          spaces={SPACES.map((name, index) => (
            <MissionControlSpace key={name} label={name} current={index === 0}>
              <span style={{ background: "var(--mac-color-system-gray)" }} />
            </MissionControlSpace>
          ))}
        />
      </div>
    </div>
  );
}
