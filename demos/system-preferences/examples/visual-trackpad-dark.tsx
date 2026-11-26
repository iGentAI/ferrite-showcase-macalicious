import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Trackpad pane in Dark Aqua, 668 x 515 pt: as the Aqua capture,
 * but with the callout on Look up & data detectors, as in Dark-System-Preferences-Trackpad.
 *
 * Reference crop x=112 y=76 w=1336 h=1030: the opaque frame without its shadow.
 */
export default function VisualTrackpadDark() {
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
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="trackpad"
        defaultSettings={{ "trackpad.preview": "look-up" }}
      />
    </div>
  );
}
