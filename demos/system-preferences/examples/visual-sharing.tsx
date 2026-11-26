import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Sharing pane, 668 x 530 pt, with File Sharing selected and the
 * search field focused, as in Light-System-Preferences-Sharing.
 *
 * Reference crop x=112 y=76 w=1336 h=1060: the opaque frame without its shadow.
 */
export default function VisualSharing() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 530,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="sharing"
        searchFieldProps={{ "data-force": "focus" } as Record<string, string>}
      />
    </div>
  );
}
