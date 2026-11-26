import { LaunchpadItem } from "macalicious/launchpad";
import { LaunchpadFolder } from "macalicious/launchpad-folder";

const COLORS = ["green", "gray", "blue", "teal", "indigo", "red", "yellow", "orange", "purple"];

/**
 * Visual comparison target: the closed folder "Other" in the Launchpad grid.
 *
 * Reference crop (2x pixels) x=2720 y=1128 w=256 h=248 of the Launchpad captures: 128 x 124 pt
 * with the 108 pt tile at 10,10. The crop ends above the label.
 *
 * The nine small icons on the tile are Apple's artwork; the example shows stand-ins and the
 * comparison masks them. Behind Launchpad is Apple's desktop picture, blurred and dimmed; the
 * example paints what the captures show around the tile, #34546c to #244663 (dark #1a3354 to
 * #142944), under the tile's own fill.
 */
export default function VisualTile() {
  return (
    <div
      style={{
        position: "relative",
        width: 128,
        height: 124,
        overflow: "clip",
        background: "linear-gradient(light-dark(#34546c, #1a3354), light-dark(#244663, #142944))",
        color: "white",
      }}
    >
      <div style={{ position: "absolute", left: 8, top: 9.5, width: 112 }}>
        <LaunchpadFolder label="Other">
          {COLORS.map((color) => (
            <LaunchpadItem key={color} label={color}>
              <span
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "22%",
                  background: `var(--mac-color-system-${color})`,
                }}
              />
            </LaunchpadItem>
          ))}
        </LaunchpadFolder>
      </div>
    </div>
  );
}
