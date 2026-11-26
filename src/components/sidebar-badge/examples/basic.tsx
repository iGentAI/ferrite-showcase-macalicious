import { SidebarBadge } from "macalicious/sidebar-badge";

const list = {
  listStyle: "none",
  margin: 0,
  padding: "6px 0",
  width: 170,
  background: "var(--mac-material-sidebar-opaque)",
  font: "var(--mac-font-body)",
} as const;
const row = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: 24,
  padding: "0 12px 0 20px",
} as const;

/** A mailbox list: the pill grows with the number of digits and is at least 24 pt wide. */
export default function Basic() {
  return (
    <ul style={list}>
      <li style={row}>
        Inbox <SidebarBadge>128</SidebarBadge>
      </li>
      <li style={row}>
        Drafts <SidebarBadge>1</SidebarBadge>
      </li>
      <li style={row}>Sent</li>
      <li style={row}>
        Junk <SidebarBadge>2048</SidebarBadge>
      </li>
    </ul>
  );
}
