import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Users & Groups pane in Aqua, 668 x 486 pt, the current account
 * selected, Password tab, locked, the Guest User alone under Other Users, as in
 * Light-System-Preferences-Users-and-Groups.
 *
 * Reference crop x=112 y=76 w=1336 h=972: the opaque frame without its shadow.
 */
export default function VisualUsersAndGroups() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 486,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="users-and-groups" />
    </div>
  );
}
