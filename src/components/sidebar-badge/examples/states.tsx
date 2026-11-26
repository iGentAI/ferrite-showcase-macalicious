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
const grey = { ...row, background: "var(--mac-color-sidebar-selection)" } as const;
const accent = {
  ...row,
  background: "var(--mac-color-sidebar-selection-emphasized)",
  color: "var(--mac-color-selected-content-text)",
} as const;
const caption = {
  margin: "0 0 4px",
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Both variants on an unselected row, a row with the grey sidebar highlight and a row with an
 * accent-coloured selection. The row tells the badge about its selection with `selected` and
 * `emphasized`.
 */
export default function States() {
  return (
    <div style={{ display: "flex", gap: 24 }}>
      {(["pill", "plain"] as const).map((variant) => (
        <div key={variant}>
          <p style={caption}>{variant}</p>
          <ul style={list}>
            <li style={row}>
              Unselected <SidebarBadge variant={variant}>5</SidebarBadge>
            </li>
            <li style={grey}>
              Selected{" "}
              <SidebarBadge variant={variant} selected>
                5
              </SidebarBadge>
            </li>
            <li style={accent}>
              Emphasised{" "}
              <SidebarBadge variant={variant} selected emphasized>
                5
              </SidebarBadge>
            </li>
          </ul>
        </div>
      ))}
    </div>
  );
}
