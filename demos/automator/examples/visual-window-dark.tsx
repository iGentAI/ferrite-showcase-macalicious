import { Automator } from "../automator";

/**
 * Visual comparison target: the whole Automator window of the dark capture, which shows the
 * same untitled workflow as the light one. The comparison clicks the search field.
 * Reference crop (2x pixels) x=112 y=76 w=2000 h=1736, i.e. the 1000 x 868 pt frame, over the
 * capture's transparent margin (matte white). The insertion point is hidden as in the light
 * example.
 */
export default function VisualWindowDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1000,
        height: 868,
        background: "#ffffff",
      }}
    >
      <Automator
        stepInterval={0}
        style={{ position: "absolute", inset: 0, ["--mac-color-text" as string]: "transparent" }}
      />
    </div>
  );
}
