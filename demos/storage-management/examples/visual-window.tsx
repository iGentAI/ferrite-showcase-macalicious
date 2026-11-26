import { StorageManagement } from "../storage-management";

/**
 * Visual comparison target: the whole Storage Management window of the light capture, with
 * Recommendations selected.
 * Reference crop (2x pixels) x=112 y=76 w=1602 h=1064, i.e. the 801 x 532 pt frame, over the
 * capture's transparent margin (matte white). The sidebar is opaque: nothing is behind the
 * window for its material to blur.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 801,
        height: 532,
        background: "var(--mac-storage-management-visual-matte)",
      }}
    >
      <StorageManagement material="opaque" style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
