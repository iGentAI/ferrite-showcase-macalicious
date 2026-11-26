import { Desktop } from "macalicious/desktop";
import { DesktopIcon } from "macalicious/desktop-icon";

/**
 * The trailing 140 pt of the Desktop captures from the top of the screen down to 240 pt, crop
 * 3080,0,280,480: the 22 pt a menu bar takes (left empty: the menu bar is another component) and the
 * first two cells of the grid. The tiles are empty, because the volume artwork is Apple's.
 */
export default function VisualGrid() {
  return (
    <div style={{ width: 140, height: 240, overflow: "hidden" }}>
      <Desktop
        picture={
          <div
            style={{
              background:
                "linear-gradient(light-dark(#a0b5c9, #041a3b) 23px, light-dark(#aacae7, #041b3e) 50px, light-dark(#9ac6ec, #041d40) 77px, light-dark(#9dcbee, #072147) 131px, light-dark(#add2f0, #0c2850) 185px, light-dark(#bed9f1, #143159) 239px)",
            }}
          />
        }
        style={
          { width: 140, height: 280, "--mac-desktop-inset-top": "22px" } as React.CSSProperties
        }
      >
        <DesktopIcon icon={null}>Macintosh SSD</DesktopIcon>
        <DesktopIcon icon={null}>Time Machine</DesktopIcon>
      </Desktop>
    </div>
  );
}
