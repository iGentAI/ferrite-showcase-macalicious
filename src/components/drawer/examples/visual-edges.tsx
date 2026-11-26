import { Drawer, DrawerPanel } from "macalicious/drawer";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";

/**
 * Fixture for the pixel checks of the left and bottom edges. A 460 x 220 pt box, white in Aqua
 * and black in Dark Aqua.
 *
 * Left: a 120 x 100 pt window at 160, 20 with a 100 pt drawer, from x 60 to x 160 and from
 * y 50 to y 112. Bottom: a 120 x 80 pt window at 320, 20 with a 60 pt drawer, from y 100 to
 * y 160 and, 8 pt in from each side, from x 328 to x 432.
 */
export default function VisualEdges() {
  return (
    <div
      style={{
        position: "relative",
        width: 460,
        height: 220,
        overflow: "hidden",
        background: "light-dark(#ffffff, #000000)",
      }}
    >
      <Drawer defaultOpen style={{ position: "absolute", left: 160, top: 20 }}>
        <Window width={120} height={100}>
          <TitleBar title="Left" />
          <WindowBody />
        </Window>
        <DrawerPanel aria-label="Left drawer" edge="left" contentSize={100} />
      </Drawer>
      <Drawer defaultOpen style={{ position: "absolute", left: 320, top: 20 }}>
        <Window width={120} height={80}>
          <TitleBar title="Bottom" />
          <WindowBody />
        </Window>
        <DrawerPanel aria-label="Bottom drawer" edge="bottom" contentSize={60} />
      </Drawer>
    </div>
  );
}
