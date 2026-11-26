import type { OtherUser } from "../panes/users-and-groups/users-and-groups";
import { SystemPreferences } from "../system-preferences";

/** The dark capture lists a second account, of the Standard kind, before the Guest User. */
const OTHER_USERS: readonly OtherUser[] = [
  { id: "jordan", name: "Jordan Lee", status: "Standard", picture: "symbol" },
  { id: "guest", name: "Guest User", status: "Off", picture: "guest" },
];

/**
 * Visual comparison target: the Users & Groups pane in Dark Aqua, 668 x 486 pt. The capture
 * differs from the light one in the list: it has a Standard account before the Guest User, as
 * in Dark-System-Preferences-Users-and-Groups.
 *
 * Reference crop x=112 y=76 w=1336 h=972: the opaque frame without its shadow.
 */
export default function VisualUsersAndGroupsDark() {
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
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="users-and-groups"
        defaultSettings={{ "users-and-groups.otherUsers": OTHER_USERS }}
      />
    </div>
  );
}
