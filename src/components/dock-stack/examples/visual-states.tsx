import { Dock } from "macalicious/dock";
import { DockStack, DockStackItem, DockStackMore } from "macalicious/dock-stack";

/**
 * State checks (no reference screenshot): a closed stack of two files on a 260 by 250 pt
 * desktop of a flat mid grey, so that every colour can be computed from the tokens. The
 * checks open it with a press and point at an item.
 */
export default function VisualStates() {
  return (
    <div style={{ position: "relative", width: 260, height: 250, background: "#808080" }}>
      <Dock>
        <DockStack
          label="Downloads"
          icon={<span style={{ width: 52, height: 52, borderRadius: 12, background: "#3366cc" }} />}
        >
          <DockStackMore>Open in Finder</DockStackMore>
          <DockStackItem>Dunes.jpg</DockStackItem>
          <DockStackItem>Harbour.jpg</DockStackItem>
        </DockStack>
      </Dock>
    </div>
  );
}
