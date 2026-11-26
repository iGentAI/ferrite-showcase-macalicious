import { MissionControl, MissionControlSpace } from "macalicious/mission-control";
import { type CSSProperties, useState } from "react";

const SPACES = ["Desktop 1", "Desktop 2", "Notes & Safari", "Photos"];

// The Spaces bar as the Aqua capture shows it: its top row, its bottom row, how much of the
// top row is left at each height, and the picture in the point under the bar.
const TOP =
  "linear-gradient(to right, #79cbfd 0px, #78cafd 120px, #78c9fd 240px, #75c8fd 360px, #71c6fd 480px, #70c5fd 600px, #74c5fd 720px, #71c3fd 840px, #73c4fd 960px, #79c4fd 1080px, #7fc6fd 1200px, #89cafd 1320px, #9ed2fc 1440px, #b8defa 1560px, #bfe4fa 1680px)";
const BOTTOM =
  "linear-gradient(to right, #8dd4fc 0px, #8ad5fc 120px, #8dd4fc 240px, #8ad3fc 360px, #83d1fc 480px, #81d0fc 600px, #81cffc 720px, #85d0fc 840px, #93d2fc 960px, #94d1fc 1080px, #97d3fc 1200px, #9ed6fc 1320px, #a4d9fb 1440px, #a3dafb 1560px, #a3dcfb 1680px)";
const FADE =
  "linear-gradient(rgb(0 0 0 / 1) 2px, rgb(0 0 0 / 0.95) 15px, rgb(0 0 0 / 0.88) 28px, rgb(0 0 0 / 0.75) 41px, rgb(0 0 0 / 0.57) 54px, rgb(0 0 0 / 0.42) 67px, rgb(0 0 0 / 0.29) 80px, rgb(0 0 0 / 0.17) 93px, rgb(0 0 0 / 0.09) 106px, rgb(0 0 0 / 0.03) 119px, rgb(0 0 0 / 0) 132px)";
const BELOW =
  "linear-gradient(to right, #7cacd2 0px, #79abd2 120px, #7bacd4 240px, #78a9d2 360px, #74a5cf 480px, #71a6ce 600px, #71a5cf 720px, #7aa8cc 840px, #75a5cb 960px, #76a6ca 1080px, #7fa7cb 1200px, #91b0cd 1320px, #86accd 1440px, #89b1cf 1560px, #91b6d1 1680px)";

const layer: CSSProperties = { position: "absolute", top: 0, left: 0, width: 1680, height: 146 };

/**
 * Visual comparison target: the Spaces bar, Aqua, with the fourth space current.
 *
 * Reference crop (2x pixels) x=0 y=0 w=3360 h=296 of the light Mission Control capture: the
 * top 1680 x 148 pt of the screen, the 146 pt bar and 2 pt of the desktop under it.
 *
 * The bar is a material over Apple's desktop picture. The example does not have the picture,
 * so it paints the bar as captured (its top and bottom rows, blended down the bar as the
 * capture blends them) and the strip of picture under it, and switches the bar's own tint
 * and blur off; the material is checked on its own in `visual-windows`. The thumbnails, the
 * ring, the names, the plus and the edge under the bar are Mission Control's. The four
 * thumbnails are pictures of Apple's desktops in the capture; the example shows plain
 * stand-ins and the comparison masks them.
 */
export default function VisualBarLight() {
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
            <MissionControlSpace key={name} label={name} current={index === 3}>
              <span style={{ background: "var(--mac-color-system-gray)" }} />
            </MissionControlSpace>
          ))}
        />
      </div>
    </div>
  );
}
