import { Dock } from "macalicious/dock";
import { DockStack, DockStackItem, DockStackMore } from "macalicious/dock-stack";

const FILES = ["Dunes.jpg", "Meadow.jpg", "Harbour.jpg", "Orchard.jpg", "Glacier.jpg"];

/**
 * State checks (no reference screenshot): a stack open as a grid on a 440 by 330 pt desktop
 * of a flat mid grey, so that every colour can be computed from the tokens.
 */
export default function VisualGrid() {
  return (
    <div style={{ position: "relative", width: 440, height: 330, background: "#808080" }}>
      <Dock>
        <DockStack view="grid" label="Pictures" defaultOpen>
          {FILES.map((name) => (
            <DockStackItem
              key={name}
              icon={<span style={{ width: 56, height: 40, background: "#3366cc" }} />}
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
