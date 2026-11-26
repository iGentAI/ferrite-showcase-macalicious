import { Dock, DockItem, DockSeparator } from "macalicious/dock";
import { DockStack, DockStackItem } from "macalicious/dock-stack";

/**
 * Visual comparison target: an open stack's tile in the Dock, the thumbnail nearest the Dock
 * and the end of its label. Reference crop (2x pixels) x=2772 y=1784 w=172 h=316 of the
 * Stacks screenshots, 86 by 158 pt: the shelf's top is 78 pt below the crop's top and the
 * tile's centre 47 pt from its left edge. The wallpaper is a plain colour that puts the shelf
 * at its measured composite. The thumbnail is a stand-in for a photograph: a 58.5 pt square
 * with the 2 pt white border the Dock gives a picture.
 */
export default function VisualTile() {
  const icon = <span style={{ width: 52, height: 52, borderRadius: 12, background: "#8e8e93" }} />;
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 86,
        height: 158,
        background: "light-dark(#142b42, #0a1828)",
      }}
    >
      <Dock style={{ left: -89, right: "auto", margin: 0 }}>
        <DockItem label="Settings" icon={icon} />
        <DockSeparator />
        <DockStack label="Downloads" icon={icon} defaultOpen>
          <DockStackItem
            icon={
              <span
                style={{
                  boxSizing: "border-box",
                  width: 58.5,
                  height: 58.5,
                  border: "2px solid #ffffff",
                  background: "#1b2c44",
                }}
              />
            }
          >
            <span style={{ display: "inline-flex", justifyContent: "center", width: 122 }}>
              10-15-beta-dark.jpg
            </span>
          </DockStackItem>
        </DockStack>
        <DockItem label="Bin" icon={icon} />
      </Dock>
    </div>
  );
}
