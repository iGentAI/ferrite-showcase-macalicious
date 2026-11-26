// The menu's stylesheet: this example draws with its classes and renders none of its parts.
import "macalicious/menu";
import { MenuItemLabel } from "macalicious/menu-item";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
  marginBottom: 6,
} as const;

const rows = (
  <>
    <div className="mac-menu-item" data-force="hover">
      <MenuItemLabel>About This Mac</MenuItemLabel>
    </div>
    <div className="mac-menu-item-separator" />
    <div className="mac-menu-item">
      <MenuItemLabel>System Preferences…</MenuItemLabel>
    </div>
    <div className="mac-menu-item">
      <MenuItemLabel keyEquivalent="control+command+q">Lock Screen</MenuItemLabel>
    </div>
  </>
);

/**
 * The two shapes of a menu, drawn statically with the menu's classes on plain elements: a
 * menu attached under a bar has square top corners, a detached one four round corners.
 */
export default function Attachment() {
  return (
    <div style={{ display: "flex", gap: 28, alignItems: "start", padding: "0 8px 16px" }}>
      <div>
        <div style={caption}>Attached</div>
        <div className="mac-menu" data-attached="" style={{ width: 200 }}>
          {rows}
        </div>
      </div>
      <div>
        <div style={caption}>Detached</div>
        <div className="mac-menu" style={{ width: 200 }}>
          {rows}
        </div>
      </div>
    </div>
  );
}
