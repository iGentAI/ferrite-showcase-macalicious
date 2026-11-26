// The menu's stylesheet: this example draws with its classes and renders none of its parts.
import "macalicious/menu";
import { MenuItemLabel } from "macalicious/menu-item";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
  marginBottom: 6,
} as const;

const sizes = [
  [undefined, "Menu font, 14 pt"],
  ["regular", "regular, 13 pt"],
  ["small", "small, 12 pt"],
  ["mini", "mini, 11 pt"],
] as const;

/** The menu font and the three control sizes, drawn statically with the menu's classes. */
export default function Sizes() {
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "start", padding: "0 8px 16px" }}>
      {sizes.map(([size, name]) => (
        <div key={name}>
          <div style={caption}>{name}</div>
          <div className="mac-menu" data-size={size} style={{ width: 132 }}>
            <div className="mac-menu-item" data-checked="">
              <MenuItemLabel>home</MenuItemLabel>
            </div>
            <div className="mac-menu-item" data-force="hover">
              <MenuItemLabel>work</MenuItemLabel>
            </div>
            <div className="mac-menu-item-separator" />
            <div className="mac-menu-item">
              <MenuItemLabel>Custom…</MenuItemLabel>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
