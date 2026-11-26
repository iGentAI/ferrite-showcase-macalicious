import { Label } from "macalicious/label";

/**
 * Visual comparison target: the first statistic in the summary box of Activity Monitor's
 * footer, the 12 pt text style (`textStyle="callout"`).
 *
 * Reference crop (2x pixels) x=386 y=1146 w=140 h=36, i.e. 70 x 18 pt on the box's fill. The
 * capitals are 8.5 pt high, from 5.75 pt to 14 pt under the crop's top.
 */
export default function VisualCallout() {
  return (
    <div
      style={{
        position: "relative",
        width: 70,
        height: 18,
        background: "light-dark(#ffffff, #38393b)",
      }}
    >
      <Label textStyle="callout" style={{ position: "absolute", left: 4.5, top: 2.5 }}>
        System:
      </Label>
    </div>
  );
}
