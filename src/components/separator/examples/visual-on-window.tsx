import { Separator } from "macalicious/separator";

/**
 * Visual comparison target: the separator in the sidebar of System Preferences › Screen Time,
 * which lies on the window background. Reference crop (2x pixels) x=132 y=716 w=240 h=22,
 * i.e. 120 x 11 pt: the line starts 5 pt from the crop's left edge and 5 pt from its top. The
 * window background in the captures is #ececec in Aqua and #2f3031 in Dark Aqua.
 */
export default function VisualOnWindow() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 120,
        height: 11,
        padding: "5px 0 0 5px",
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <Separator />
    </div>
  );
}
