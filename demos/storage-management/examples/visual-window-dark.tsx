import { StorageManagement } from "../storage-management";
import { darkCaptureAvailable, darkCaptureCategories } from "../storage-management-data";

/**
 * Visual comparison target: the whole Storage Management window of the dark capture, which
 * lists Podcasts and Trash as well, has Other alone under the second line and 193.78 GB free.
 * Reference crop (2x pixels) x=112 y=76 w=1602 h=1064, i.e. the 801 x 532 pt frame, over the
 * capture's transparent margin (matte white).
 */
export default function VisualWindowDark() {
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
      <StorageManagement
        material="opaque"
        categories={darkCaptureCategories}
        available={darkCaptureAvailable}
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}
