import { Drawer, DrawerPanel, DrawerTrigger } from "macalicious/drawer";
import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";

/**
 * Fixture for the pixel checks in `drawer.visual.json`: no screenshot shows a drawer, so the
 * checks hold an open and a closed drawer to the values the spec infers.
 *
 * A 400 x 220 pt box, white in Aqua and black in Dark Aqua so that the drawer's fill differs
 * from what is behind it. The window is 200 x 160 pt at 20, 20. The drawer is 120 pt wide: it
 * runs from the window's right edge at x 220 to x 340, and from y 50 (30 pt under the window's
 * top) to y 172 (8 pt above its bottom). The button is the only one in the box.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        position: "relative",
        width: 400,
        height: 220,
        overflow: "hidden",
        background: "light-dark(#ffffff, #000000)",
      }}
    >
      <Drawer defaultOpen style={{ position: "absolute", left: 20, top: 20 }}>
        <Window width={200} height={160}>
          <TitleBar title="Notes" />
          <WindowBody style={{ padding: 20 }}>
            <DrawerTrigger render={<PushButton />}>Details</DrawerTrigger>
          </WindowBody>
        </Window>
        <DrawerPanel aria-label="Details" contentSize={120} />
      </Drawer>
    </div>
  );
}
