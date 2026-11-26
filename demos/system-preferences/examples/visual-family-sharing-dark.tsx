import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Family Sharing pane in Dark Aqua, 668 x 328 pt: as the Aqua
 * capture, but the search field is not focused, as in Dark-System-Preferences-Family-Sharing.
 *
 * Reference crop x=112 y=76 w=1336 h=656: the opaque frame without its shadow.
 */
export default function VisualFamilySharingDark() {
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
      <SystemPreferences style={{ position: "absolute" }} defaultPane="family-sharing" />
    </div>
  );
}
