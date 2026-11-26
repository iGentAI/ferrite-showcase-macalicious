import { DiskUtility } from "../disk-utility";
import { darkCaptureDisks } from "../disk-utility-data";

/**
 * Visual comparison target: the whole Disk Utility window of the dark capture, whose selected
 * volume holds less than in the light one (10.9 GB used, 191.72 GB free).
 * Reference crop (2x pixels) x=112 y=76 w=1852 h=1142, i.e. the 926 x 571 pt frame, over the
 * capture's transparent margin (matte white).
 */
export default function VisualWindowDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 926,
        height: 571,
        background: "var(--mac-disk-utility-visual-matte)",
      }}
    >
      <DiskUtility disks={darkCaptureDisks} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
