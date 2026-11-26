import { Label } from "macalicious/label";

/**
 * Visual comparison target: the text under the icon of System Preferences > Software Update.
 *
 * Reference crop (2x pixels) x=160 y=450 w=300 h=160, i.e. 150 x 80 pt on the window
 * background. A centred 13 pt bold title, three centred lines of 11 pt text on a 14 pt pitch,
 * and an 11 pt link. The text is centred 72 pt from the crop's left edge.
 */
export default function VisualSoftwareUpdate() {
  return (
    <div
      style={{
        position: "relative",
        width: 150,
        height: 80,
        overflow: "hidden",
        background: "light-dark(#ececec, #303031)",
      }}
    >
      <Label
        textStyle="emphasized"
        align="center"
        style={{ position: "absolute", left: -3, top: 2.5, width: 150 }}
      >
        Software Update
      </Label>
      <Label
        textStyle="small"
        align="center"
        style={{ position: "absolute", left: -3, top: 22, width: 150, whiteSpace: "pre" }}
      >
        {"This Mac is enrolled in the\nApple Developer Seed\nProgram"}
      </Label>
      <Label
        textStyle="small"
        color="link"
        align="center"
        style={{ position: "absolute", left: -3, top: 64, width: 150 }}
        render={<a href="#details" />}
      >
        Details…
      </Label>
    </div>
  );
}
