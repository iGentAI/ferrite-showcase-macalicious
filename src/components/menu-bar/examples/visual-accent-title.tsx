import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuItem } from "macalicious/menu-item";
import { useState } from "react";

/** The sky just under the menu bar: a stand-in for the desktop picture, which is not shipped. */
const sky = "light-dark(#5b96c3, #294872)";

/**
 * The open application title of the 16 accent screenshots (Theme-Light-<Accent> and
 * Theme-Dark-<Accent>): crop 90,0 of 314 x 46 px, the "System Preferences" cell, 157 pt wide
 * in San Francisco. The comparison clicks the title, which opens its menu and highlights the
 * cell in the accent colour.
 */
export default function VisualAccentTitle() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setStage} style={{ position: "relative", width: 157, height: 23, background: sky }}>
      <MenuBar style={{ paddingInlineStart: 0 }}>
        <MenuBarMenu
          title="System Preferences"
          application
          titleProps={{ "data-testid": "app", style: { width: 157 } } as object}
          popup={{ container: stage, collisionPadding: 0, style: { width: 236 } }}
        >
          <MenuItem>About System Preferences</MenuItem>
        </MenuBarMenu>
      </MenuBar>
    </div>
  );
}
