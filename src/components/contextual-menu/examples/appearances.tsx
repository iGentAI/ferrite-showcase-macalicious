// The stylesheets of the menu and of the contextual menu: this example draws with their
// classes and renders none of their parts.
import "macalicious/contextual-menu";
import "macalicious/menu";
import { MenuItemLabel } from "macalicious/menu-item";

/**
 * A contextual menu in the appearance of its surroundings, drawn statically with the classes
 * of the menu and its items on plain elements: a detached menu whose items show no key
 * equivalents. A real contextual menu renders in a portal and follows the appearance of the
 * page.
 */
export default function Appearances() {
  return (
    <div style={{ padding: "0 8px 16px" }}>
      <div
        className="mac-menu mac-contextual-menu"
        data-key-equivalents="hidden"
        style={{ width: 180 }}
      >
        <div className="mac-menu-item" data-force="hover">
          <MenuItemLabel keyEquivalent="shift+command+n">New Folder</MenuItemLabel>
        </div>
        <div className="mac-menu-item-separator" />
        <div className="mac-menu-item">
          <MenuItemLabel keyEquivalent="command+i">Get Info</MenuItemLabel>
        </div>
        <div className="mac-menu-item" data-disabled="">
          <MenuItemLabel keyEquivalent="command+v">Paste Item</MenuItemLabel>
        </div>
        <div className="mac-menu-item-separator" />
        <div className="mac-menu-item">
          <MenuItemLabel>Clean Up</MenuItemLabel>
        </div>
        <div className="mac-menu-item">
          <MenuItemLabel keyEquivalent="command+j">Show View Options</MenuItemLabel>
        </div>
      </div>
    </div>
  );
}
