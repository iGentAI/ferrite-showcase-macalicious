import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Apple ID pane in Aqua, 668 x 598 pt, on the iCloud page, with
 * the search field focused, as in Light-System-Preferences-Apple-ID.
 *
 * Reference crop x=112 y=76 w=1336 h=1196: the opaque frame without its shadow.
 */
export default function VisualAppleId() {
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
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="apple-id"
        searchFieldProps={{ "data-force": "focus" } as Record<string, string>}
      />
    </div>
  );
}
