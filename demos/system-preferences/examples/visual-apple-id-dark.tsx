import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Apple ID pane in Dark Aqua, 668 x 598 pt: as the Aqua capture,
 * but the search field is not focused, as in Dark-System-Preferences-Apple-ID.
 *
 * Reference crop x=112 y=76 w=1336 h=1196: the opaque frame without its shadow.
 */
export default function VisualAppleIdDark() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 598,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="apple-id" />
    </div>
  );
}
