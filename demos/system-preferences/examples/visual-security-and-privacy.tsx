import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Security & Privacy pane in Aqua, 668 x 573 pt, General tab,
 * locked, as in Light-System-Preferences-Security-and-Privacy. The dark capture shows the same
 * state.
 *
 * Reference crop x=112 y=76 w=1336 h=1146: the opaque frame without its shadow.
 */
export default function VisualSecurityAndPrivacy() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 573,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="security-and-privacy" />
    </div>
  );
}
