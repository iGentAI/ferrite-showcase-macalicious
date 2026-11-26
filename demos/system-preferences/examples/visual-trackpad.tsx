import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Trackpad pane, 668 x 515 pt, on the Point & Click tab with the
 * settings of Light-System-Preferences-Trackpad: the callout is on Secondary click. The dark
 * capture has the same settings with the callout on another row (visual-trackpad-dark).
 *
 * Reference crop x=112 y=76 w=1336 h=1030: the opaque frame without its shadow.
 */
export default function VisualTrackpad() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 515,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="trackpad" />
    </div>
  );
}
