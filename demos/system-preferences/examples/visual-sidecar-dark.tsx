import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Sidecar pane in Dark Aqua, 668 x 354 pt: as the Aqua capture,
 * but without the focus in the search field, as in Dark-System-Preferences-Sidecar.
 *
 * Reference crop x=112 y=76 w=1336 h=708: the opaque frame without its shadow.
 */
export default function VisualSidecarDark() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 354,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="sidecar" />
    </div>
  );
}
