import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Sidecar pane in Aqua, 668 x 354 pt, with the search field
 * focused as in Light-System-Preferences-Sidecar.
 *
 * Reference crop x=112 y=76 w=1336 h=708: the opaque frame without its shadow.
 */
export default function VisualSidecar() {
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
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="sidecar"
        searchFieldProps={{ "data-force": "focus" } as Record<string, string>}
      />
    </div>
  );
}
