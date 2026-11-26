import { Dock } from "macalicious/dock";
import { DockStack, DockStackItem, DockStackMore } from "macalicious/dock-stack";

const FILES = ["Dunes.jpg", "Meadow.jpg", "Harbour.jpg"];

/**
 * State checks (no reference screenshot): a stack open as a list on a 240 by 260 pt desktop
 * of a flat mid grey, so that every colour can be computed from the tokens.
 */
export default function VisualList() {
  return (
    <div style={{ position: "relative", width: 240, height: 260, background: "#808080" }}>
      <Dock>
        <DockStack view="list" label="Pictures" defaultOpen>
          {FILES.map((name) => (
            <DockStackItem
              key={name}
              icon={<span style={{ width: 14, height: 10, background: "#3366cc" }} />}
            >
              {name}
            </DockStackItem>
          ))}
          <DockStackMore>Open in Finder</DockStackMore>
        </DockStack>
      </Dock>
    </div>
  );
}
