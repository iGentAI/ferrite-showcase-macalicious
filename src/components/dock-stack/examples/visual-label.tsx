import { Dock } from "macalicious/dock";
import { DockStack, DockStackItem } from "macalicious/dock-stack";

/**
 * Visual comparison target: the label of the item nearest the Dock, turned 1.6 degrees.
 * Reference crop (2x pixels) x=2490 y=1810 w=312 h=70 of the Stacks screenshots, 156 by 35
 * pt. The stack's tile is where the screenshot has it, outside the box: 188 pt from the
 * crop's left edge and 71 pt below its top. The background is the mean colour of the sea
 * around the label in each screenshot. The text is given the width it has in San Francisco
 * (122 pt), so that the label is as wide as in the screenshot in the fallback font too.
 */
export default function VisualLabel() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 156,
        height: 35,
        background: "light-dark(#16334b, #0b1a2c)",
      }}
    >
      <Dock style={{ inset: "65px auto auto 150px", margin: 0 }}>
        <DockStack label="Downloads" defaultOpen>
          <DockStackItem>
            <span style={{ display: "inline-flex", justifyContent: "center", width: 122 }}>
              10-15-beta-dark.jpg
            </span>
          </DockStackItem>
        </DockStack>
      </Dock>
    </div>
  );
}
