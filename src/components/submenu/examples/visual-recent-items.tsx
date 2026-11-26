// The stylesheets of the menu and the submenu: this example draws with their classes.
import "macalicious/menu";
import "macalicious/submenu";
import { MenuItemLabel } from "macalicious/menu-item";

/**
 * The sky of the Catalina desktop picture behind the Apple menu, as a gradient of the colours
 * down one column of the Desktop screenshots. A stand-in for the picture, which is Apple's and
 * is not shipped.
 */
const sky =
  "linear-gradient(light-dark(#5f94c3, #27446f) 2px, light-dark(#6ba2d3, #27446f) 14px, light-dark(#75aedf, #26436c) 27px, light-dark(#81b9ec, #26416a) 40px, light-dark(#8abeee, #25426b) 52px, light-dark(#81bded, #294771) 86px, light-dark(#8dc6f3, #314e79) 125px, light-dark(#93caf4, #3a5883) 151px, light-dark(#a1d1f7, #47668f) 188px, light-dark(#aed9f9, #4a6a92) 223px, light-dark(#b9dffa, #5c7ba0) 255px, light-dark(#c4e1f9, #6481a6) 283px)";

const item = (title: string) => (
  <div className="mac-menu-item">
    <MenuItemLabel>{title}</MenuItemLabel>
  </div>
);

/**
 * The "Recent Items" parent row of the Apple menu with the separators above and below it:
 * crop 0,190 of 470 x 86 px of the Apple-Menu screenshots, the 43 pt band that lies 73 pt
 * below the menu bar.
 *
 * The band is in the middle of the menu, so the menu is drawn here statically, with the menu's
 * classes on plain elements and scrolled up behind the box: an open menu positions itself
 * inside the viewport and cannot be placed partly above it. The comparison is of the parent
 * row's drawing; `visual-open` checks the real parts.
 */
export default function VisualRecentItems() {
  return (
    <div style={{ width: 235, height: 43, overflow: "hidden" }}>
      <div
        style={{ position: "relative", width: 235, height: 278, marginTop: -73, background: sky }}
      >
        <div
          className="mac-menu"
          data-attached=""
          style={{ position: "absolute", left: 10, top: 0, width: 208 }}
        >
          {item("About This Mac")}
          <div className="mac-menu-item-separator" />
          {item("System Preferences…")}
          {item("App Store…")}
          <div className="mac-menu-item-separator" />
          <div className="mac-menu-item mac-submenu-trigger">
            <MenuItemLabel>Recent Items</MenuItemLabel>
          </div>
          <div className="mac-menu-item-separator" />
          {item("Force Quit…")}
          <div className="mac-menu-item-separator" />
          {item("Sleep")}
          {item("Restart…")}
          {item("Shut Down…")}
          <div className="mac-menu-item-separator" />
          {item("Lock Screen")}
          {item("Log Out Stephen…")}
        </div>
      </div>
    </div>
  );
}
