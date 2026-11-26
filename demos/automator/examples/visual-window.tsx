import { Automator } from "../automator";

/**
 * Visual comparison target: the whole Automator window of the light capture, an untitled
 * workflow with nothing in it: Library selected in the outline, Activate Fonts in the list and
 * its description under both. The comparison clicks the search field, which has the keyboard
 * focus in the capture. No timer runs: a workflow without steps cannot be run.
 * Reference crop (2x pixels) x=112 y=76 w=2000 h=1736, i.e. the 1000 x 868 pt frame, over the
 * capture's transparent margin (matte white).
 *
 * The reference shows no insertion point, and a blinking one would make the capture depend on
 * its timing, so this example hides it: the field takes its insertion point colour from the
 * text colour token, which is made transparent here. An application does not do this.
 */
export default function VisualWindow() {
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
