import { QuickLookPanel } from "macalicious/quick-look-panel";

/**
 * Visual comparison target: the leading end of the Quick Look bar with the close and
 * full-screen discs, and the panel's top-left corner. Reference crop (2x pixels) w=130 h=76
 * from the panel's top-left corner: x=1480 y=90 in the light capture, x=964 y=118 in the dark
 * one, i.e. 65 x 38 pt.
 *
 * The panel floats over the desktop picture, so the bar's colour is the picture's, blurred and
 * tinted. The example paints, behind the panel, the flat colour that gives the bar colour
 * measured at this end of the bar.
 */
export default function VisualControls() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 65,
        height: 38,
        background: "light-dark(#5e92b9, #202e43)",
      }}
    >
      <QuickLookPanel
        title="10-9.jpg"
        width={892}
        height={547}
        style={{ position: "absolute", top: 0, left: 0 }}
      />
    </div>
  );
}
