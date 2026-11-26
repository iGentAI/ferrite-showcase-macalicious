import { DiskUtility } from "../disk-utility";

/**
 * Visual comparison target: the whole Disk Utility window of the light capture, with
 * Macintosh SSD selected.
 * Reference crop (2x pixels) x=112 y=76 w=1852 h=1142, i.e. the 926 x 571 pt frame, over the
 * capture's transparent margin (matte white).
 */
export default function VisualWindow() {
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
      <DiskUtility style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
