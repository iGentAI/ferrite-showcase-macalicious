import { Drawer, DrawerPanel, DrawerTrigger } from "macalicious/drawer";
import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";

/** A drawer at each of the three edges. The bottom one leaves the window's corners free. */
export default function Edges() {
  return (
    <div style={{ display: "flex", gap: 24, padding: "8px 24px 90px" }}>
      {(["left", "right", "bottom"] as const).map((edge) => (
        <div key={edge} style={{ padding: "0 100px" }}>
          <Drawer defaultOpen>
            <Window width={170} height={130}>
              <TitleBar title={edge} />
              <WindowBody style={{ padding: 12 }}>
                <DrawerTrigger render={<PushButton size="small" />}>Drawer</DrawerTrigger>
              </WindowBody>
            </Window>
            <DrawerPanel aria-label={`Drawer at the ${edge}`} edge={edge} contentSize={70}>
              <div style={{ padding: 8 }}>{edge}</div>
            </DrawerPanel>
          </Drawer>
        </div>
      ))}
    </div>
  );
}
