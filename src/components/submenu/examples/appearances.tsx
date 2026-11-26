// The stylesheets of the menu and of the submenu: this example draws with their classes and
// renders none of their parts.
import "macalicious/menu";
import { MenuItemLabel } from "macalicious/menu-item";
import "macalicious/submenu";

/**
 * An open submenu in the appearance of its surroundings, drawn statically with the classes of
 * the menu, its items and the submenu's parent item on plain elements. A real submenu renders
 * in a portal and follows the appearance of the page.
 */
export default function Appearances() {
  return (
    <div style={{ display: "flex", alignItems: "start", padding: "0 8px 16px" }}>
      <div className="mac-menu" style={{ width: 150 }}>
        <div className="mac-menu-item">
          <MenuItemLabel keyEquivalent="command+n">New</MenuItemLabel>
        </div>
        <div className="mac-menu-item mac-submenu-trigger" data-popup-open="">
          <MenuItemLabel>Open Recent</MenuItemLabel>
        </div>
        <div className="mac-menu-item-separator" />
        <div className="mac-menu-item">
          <MenuItemLabel keyEquivalent="command+w">Close</MenuItemLabel>
        </div>
      </div>
      {/* Beside the parent item, its first row level with that item: both are 4 pt under the
          top of their menu, and the parent item is the second 19 pt row. */}
      <div className="mac-menu mac-submenu" style={{ width: 140, marginTop: 19 }}>
        <div className="mac-menu-item">
          <MenuItemLabel>Budget.numbers</MenuItemLabel>
        </div>
        <div className="mac-menu-item">
          <MenuItemLabel>Letter.rtf</MenuItemLabel>
        </div>
        <div className="mac-menu-item-separator" />
        <div className="mac-menu-item">
          <MenuItemLabel>Clear Menu</MenuItemLabel>
        </div>
      </div>
    </div>
  );
}
