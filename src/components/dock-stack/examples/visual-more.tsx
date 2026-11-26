import { Dock } from "macalicious/dock";
import { DockStack, DockStackItem, DockStackMore } from "macalicious/dock-stack";

const FILES = ["j", "i", "h", "g", "f", "e", "d", "c", "b", "a"];

/**
 * Visual comparison target: the far end of a fan of ten files, the "7 More in Finder" label
 * and its round button, over the sky. Reference crop (2x pixels) x=2712 y=460 w=408 h=180 of
 * the Stacks screenshots, 204 by 90 pt. The stack's tile is where the screenshot has it, 77
 * pt from the crop's left edge and 746 pt below its top, so the Dock itself is outside the
 * box. The background is a gradient fitted to the sky in each screenshot. The text is given
 * the width it has in San Francisco (97 pt), so that the label is as wide as in the
 * screenshot in the fallback font too.
 */
export default function VisualMore() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 204,
        height: 90,
        background:
          "linear-gradient(calc(169deg + 31deg * var(--mac-appearance-dark)), light-dark(#abcfed, #15335c), light-dark(#d4e0ec, #314f7a))",
      }}
    >
      <Dock style={{ inset: "740px auto auto 39px", margin: 0 }}>
        <DockStack label="Downloads" defaultOpen>
          <DockStackMore>
            <span style={{ display: "inline-flex", justifyContent: "center", width: 97 }}>
              7 More in Finder
            </span>
          </DockStackMore>
          {FILES.map((name) => (
            <DockStackItem key={name}>{name}.jpg</DockStackItem>
          ))}
        </DockStack>
      </Dock>
    </div>
  );
}
