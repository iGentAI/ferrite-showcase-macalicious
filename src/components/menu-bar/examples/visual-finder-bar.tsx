import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuItem } from "macalicious/menu-item";
import { useState } from "react";

/**
 * The sky of the Catalina desktop picture just under the menu bar (Desktop screenshots, y 47
 * at x 400): a stand-in for the picture, which is Apple's and is not shipped.
 */
const sky = "light-dark(#5b94c3, #274671)";

/** A stand-in for the mark of the Apple menu, with its ink box: 12.5 x 15.5 pt at 21, 2. */
function Mark() {
  return (
    <svg width="15" height="20" viewBox="0 0 15 20" fill="currentColor" aria-hidden="true">
      <ellipse cx="7.25" cy="8.75" rx="6.25" ry="7.75" />
    </svg>
  );
}

const menus = ["File", "Edit", "View", "Go", "Window", "Help"];

/**
 * The left end of Finder's menu bar as in the Desktop and Apple-Menu screenshots: crop 0,0 of
 * 800 x 46 px, the 22 pt bar and its shadow line over the sky. The comparisons click the
 * Apple title to open its menu, and move the pointer along the bar while a menu is open.
 */
export default function VisualFinderBar() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const popup = { container: stage, collisionPadding: 0 };
  return (
    <div ref={setStage} style={{ position: "relative", width: 400, height: 23, background: sky }}>
      <MenuBar>
        <MenuBarMenu
          title={<Mark />}
          aria-label="Apple"
          titleProps={{ "data-testid": "apple" } as object}
          popup={{ ...popup, style: { width: 208 } }}
        >
          <MenuItem>About This Mac</MenuItem>
        </MenuBarMenu>
        <MenuBarMenu
          title="Finder"
          application
          titleProps={{ "data-testid": "finder" } as object}
          popup={popup}
        >
          <MenuItem>About Finder</MenuItem>
        </MenuBarMenu>
        {menus.map((title) => (
          <MenuBarMenu
            key={title}
            title={title}
            titleProps={{ "data-testid": title.toLowerCase() } as object}
            popup={popup}
          >
            <MenuItem>{title} Help</MenuItem>
          </MenuBarMenu>
        ))}
      </MenuBar>
    </div>
  );
}
