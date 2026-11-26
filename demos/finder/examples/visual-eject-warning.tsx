import { FinderEjectWarning } from "../finder-dialogs";

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Eject-Warning.png, the whole capture
 * with the notification's shadow (764 x 202 px, 382 x 101 pt; the notification is 344 x 63 pt
 * at 19, 18). The capture records the material with nothing behind it, so the notification is
 * drawn opaque. The Finder icon is Apple's artwork: the demo's lettered tile stands in for it
 * and the comparisons mask it.
 */
export default function VisualEjectWarning() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        overflow: "hidden",
        width: 382,
        height: 101,
        padding: "18px 0 0 19px",
        background: "#ffffff",
      }}
    >
      <FinderEjectWarning material="opaque" disk="USB Key" />
    </div>
  );
}
