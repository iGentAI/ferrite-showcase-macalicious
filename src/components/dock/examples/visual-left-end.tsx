import { Dock, DockItem } from "macalicious/dock";

/**
 * Visual comparison target: the left end of the Dock with its first tile, a running
 * application. Reference crop (2x pixels) x=272 y=1930 w=162 h=170 of the Desktop
 * screenshots, 81 by 85 pt: the shelf starts 5 pt from the crop's left edge and 5 pt below
 * its top. The wallpaper is the mean colour of the photograph above the shelf in each
 * screenshot. The icon is a stand-in, masked in the comparison.
 */
export default function VisualLeftEnd() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 81,
        height: 85,
        background: "light-dark(#062845, #081422)",
      }}
    >
      <Dock style={{ left: 5, right: "auto", margin: 0 }}>
        {["Files", "Mail"].map((label) => (
          <DockItem
            key={label}
            label={label}
            running={label === "Files"}
            icon={
              <span style={{ width: 52, height: 52, borderRadius: 12, background: "#8e8e93" }} />
            }
          />
        ))}
      </Dock>
    </div>
  );
}
