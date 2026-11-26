import type { SharedFolder, SharingUser } from "../panes/sharing/sharing";
import { SystemPreferences } from "../system-preferences";

const GROUPS: readonly SharingUser[] = [
  { id: "staff", name: "Staff", kind: "group", access: "read-only" },
  { id: "everyone", name: "Everyone", kind: "everyone", access: "read-only" },
];

/**
 * The dark capture shares a second folder, the Public folder of another account, before the
 * home folder, and has it selected. Its name is truncated in the middle, as captured.
 */
const FOLDERS: readonly SharedFolder[] = [
  {
    id: "public",
    name: "jordanlee’s Public Folder",
    title: "jordanlee’s…blic Folder",
    kind: "public",
    users: [{ id: "owner", name: "jordanlee", kind: "user", access: "read-write" }, ...GROUPS],
  },
  {
    id: "home",
    name: "alexmorgan",
    title: "alexmorgan",
    kind: "home",
    users: [{ id: "owner", name: "Alex Morgan", kind: "user", access: "read-write" }, ...GROUPS],
  },
];

/** The dark capture lists Internet Sharing before Bluetooth Sharing. */
const SERVICES = [
  "screen-sharing",
  "file-sharing",
  "media-sharing",
  "printer-sharing",
  "remote-login",
  "remote-management",
  "remote-apple-events",
  "internet-sharing",
  "bluetooth-sharing",
  "content-caching",
];

/**
 * Visual comparison target: the Sharing pane in Dark Aqua, 668 x 530 pt. The capture differs
 * from the light one in content: two shared folders with the first selected, its owner first
 * under Users, and two services in the other order, as in Dark-System-Preferences-Sharing. The
 * search field is not focused.
 *
 * Reference crop x=112 y=76 w=1336 h=1060: the opaque frame without its shadow.
 */
export default function VisualSharingDark() {
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
        defaultSettings={{
          "sharing.services": SERVICES,
          "sharing.folders": FOLDERS,
          "sharing.folder": "public",
        }}
      />
    </div>
  );
}
