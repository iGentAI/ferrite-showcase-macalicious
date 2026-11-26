import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { useState } from "react";

/**
 * The sky of the Catalina desktop picture behind the menu, as a gradient of the colours down
 * one column of the Desktop screenshots. A stand-in for the picture, which is Apple's and is
 * not shipped.
 */
const sky =
  "linear-gradient(light-dark(#5f94c3, #27446f) 2px, light-dark(#6ba2d3, #27446f) 14px, light-dark(#75aedf, #26436c) 27px, light-dark(#81b9ec, #26416a) 40px, light-dark(#8abeee, #25426b) 52px, light-dark(#81bded, #294771) 86px, light-dark(#8dc6f3, #314e79) 125px, light-dark(#93caf4, #3a5883) 151px, light-dark(#a1d1f7, #47668f) 188px)";

/**
 * The System Preferences application menu of the 16 accent screenshots (Theme-Light-<Accent>
 * and Theme-Dark-<Accent>): crop 70,44 of 510 x 336 px, with "About System Preferences"
 * highlighted in the accent colour. The menu hangs from the menu bar at x 10 and is 236 pt
 * wide (fill and rim from pixel 90 to 561 of the captures).
 */
export default function VisualAccentMenu() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setStage} style={{ position: "relative", width: 255, height: 168, background: sky }}>
      <div
        style={{
          position: "absolute",
          inset: "0 0 auto",
          height: 1,
          background: "light-dark(rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.36))",
        }}
      />
      <Menu defaultOpen modal={false}>
        <MenuTrigger
          aria-label="System Preferences"
          style={{
            position: "absolute",
            left: 10,
            top: -22,
            width: 157,
            height: 22,
            padding: 0,
            border: 0,
            background: "none",
          }}
        />
        <MenuPopup attached container={stage} collisionPadding={0} style={{ width: 236 }}>
          <MenuItem data-testid="about">About System Preferences</MenuItem>
          <MenuSeparator />
          <Submenu>
            <SubmenuTrigger>Services</SubmenuTrigger>
            <SubmenuPopup container={stage}>
              <MenuItem disabled>No Services Apply</MenuItem>
            </SubmenuPopup>
          </Submenu>
          <MenuSeparator />
          <MenuItem keyEquivalent="command+h">Hide System Preferences</MenuItem>
          <MenuItem keyEquivalent="option+command+h">Hide Others</MenuItem>
          <MenuItem disabled>Show All</MenuItem>
          <MenuSeparator />
          <MenuItem keyEquivalent="command+q">Quit System Preferences</MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}
