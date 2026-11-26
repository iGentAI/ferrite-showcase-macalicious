import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuBarExtraMenu, MenuBarExtras } from "macalicious/menu-bar-extra";
import { MenuItem } from "macalicious/menu-item";
import { useState } from "react";

/** The desktop picture under this part of the bar (Desktop screenshots, y 47 at x 2700). */
const sky = "light-dark(#6795bf, #032143)";

const cell = (width: number, testid?: string) =>
  ({ "data-testid": testid, style: { width, justifyContent: "center", padding: 0 } }) as object;

/**
 * The open battery extra of the Menu-Bar-Battery screenshots: a 116 x 46 px crop with the
 * 36 pt cell from x 11, between the end of the AirPlay cell and the start of the clock. The
 * battery image is a stand-in of the size of Apple's. The comparison clicks the cell, which
 * opens its menu and highlights the cell.
 */
export default function VisualBatteryOpen() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const popup = { container: stage, collisionPadding: 0 };
  return (
    <div ref={setStage} style={{ position: "relative", width: 58, height: 23, background: sky }}>
      {/* The bar is cut to the crop here, so that the stage does not confine the menu. */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <MenuBar
          style={{ position: "absolute", insetInlineEnd: -96, width: 640 }}
          extras={
            <MenuBarExtras>
              <MenuBarExtraMenu title="" aria-label="AirPlay" titleProps={cell(33)} popup={popup}>
                <MenuItem>Open Displays Preferences…</MenuItem>
              </MenuBarExtraMenu>
              <MenuBarExtraMenu
                aria-label="Battery"
                titleProps={cell(36, "battery")}
                popup={{ ...popup, style: { width: 283 } }}
                title={
                  <svg
                    width="22.5"
                    height="12"
                    viewBox="0 0 22.5 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect x="0.5" y="0.5" width="19" height="11" rx="2.5" stroke="currentColor" />
                    <rect x="2" y="2" width="16" height="8" rx="1" fill="currentColor" />
                    <rect x="21" y="4" width="1.5" height="4" fill="currentColor" />
                  </svg>
                }
              >
                <MenuItem>Show Percentage</MenuItem>
              </MenuBarExtraMenu>
              <MenuBarExtraMenu title="" aria-label="Clock" titleProps={cell(107)} popup={popup}>
                <MenuItem>Open Date &amp; Time Preferences…</MenuItem>
              </MenuBarExtraMenu>
            </MenuBarExtras>
          }
        >
          <MenuBarMenu title="Finder" application popup={popup}>
            <MenuItem>About Finder</MenuItem>
          </MenuBarMenu>
        </MenuBar>
      </div>
    </div>
  );
}
