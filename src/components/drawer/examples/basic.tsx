import { Drawer, DrawerPanel, DrawerTrigger } from "macalicious/drawer";
import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";

export default function Basic() {
  return (
    // The drawer hangs outside the window: leave room for it and for the shadows.
    <div style={{ padding: "8px 190px 40px 24px" }}>
      <Drawer defaultOpen>
        <Window width={260} height={180}>
          <TitleBar title="Notes" />
          <WindowBody style={{ padding: 20 }}>
            <DrawerTrigger render={<PushButton />}>Details</DrawerTrigger>
          </WindowBody>
        </Window>
        <DrawerPanel aria-label="Details" contentSize={150}>
          <div style={{ padding: 12 }}>Created today at 9:41 AM</div>
        </DrawerPanel>
      </Drawer>
    </div>
  );
}
