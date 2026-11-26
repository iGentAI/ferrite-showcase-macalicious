import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Family Sharing pane in Aqua, 668 x 328 pt, before a family is
 * set up, with the search field focused, as in Light-System-Preferences-Family-Sharing.
 *
 * Reference crop x=112 y=76 w=1336 h=656: the opaque frame without its shadow.
 */
export default function VisualFamilySharing() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 328,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="family-sharing"
        searchFieldProps={{ "data-force": "focus" } as Record<string, string>}
      />
    </div>
  );
}
