// The menu's stylesheet: this example draws with its classes and renders none of its parts.
import "macalicious/menu";
import { MenuItemLabel } from "macalicious/menu-item";

/** A stand-in template image: a folder outline drawn for this example. */
const folder = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path
      d="M1.5 4a1 1 0 0 1 1-1h3.2l1.3 1.5h6.5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z"
      fill="none"
      stroke="currentColor"
    />
  </svg>
);

/**
 * Every kind and state of a menu row, drawn statically with the item's classes and state
 * attributes on plain elements (the same contract a row on another primitive uses). In an
 * application the attributes come from Base UI.
 */
export default function States() {
  return (
    <div style={{ padding: "0 8px 16px" }}>
      <div className="mac-menu" style={{ width: 248 }}>
        <div className="mac-menu-item">
          <MenuItemLabel>Normal</MenuItemLabel>
        </div>
        <div className="mac-menu-item" data-force="hover">
          <MenuItemLabel keyEquivalent="shift+command+h">Highlighted</MenuItemLabel>
        </div>
        <div className="mac-menu-item" data-disabled="">
          <MenuItemLabel keyEquivalent="command+h">Disabled</MenuItemLabel>
        </div>
        <div className="mac-menu-item-separator" />
        <div className="mac-menu-item" data-checked="">
          <MenuItemLabel>On</MenuItemLabel>
        </div>
        <div className="mac-menu-item" data-mixed="">
          <MenuItemLabel>Mixed</MenuItemLabel>
        </div>
        <div className="mac-menu-item" data-checked="" data-force="hover">
          <MenuItemLabel>On and highlighted</MenuItemLabel>
        </div>
        <div className="mac-menu-item-separator" />
        <div className="mac-menu-item-header">Section Header</div>
        <div className="mac-menu-item">
          <MenuItemLabel image={folder} keyEquivalent="option+command+l">
            With an image
          </MenuItemLabel>
        </div>
        <div className="mac-menu-item" data-indentation="1">
          <MenuItemLabel>Indented one level</MenuItemLabel>
        </div>
      </div>
    </div>
  );
}
