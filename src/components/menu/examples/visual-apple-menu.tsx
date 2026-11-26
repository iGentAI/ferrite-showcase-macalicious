import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { useState } from "react";

/**
 * The sky of the Catalina desktop picture behind the Apple menu, as a gradient: the colours
 * of column x=300 (Aqua) and x=220 (Dark Aqua) of the Desktop screenshots, from the menu
 * bar's lower edge down. A stand-in for the picture, which is Apple's and is not shipped.
 */
const sky =
  "linear-gradient(light-dark(#5f94c3, #27446f) 2px, light-dark(#6ba2d3, #27446f) 14px, light-dark(#75aedf, #26436c) 27px, light-dark(#81b9ec, #26416a) 40px, light-dark(#8abeee, #25426b) 52px, light-dark(#81bded, #294771) 86px, light-dark(#8dc6f3, #314e79) 125px, light-dark(#93caf4, #3a5883) 151px, light-dark(#a1d1f7, #47668f) 188px, light-dark(#aed9f9, #4a6a92) 223px, light-dark(#b9dffa, #5c7ba0) 255px, light-dark(#c4e1f9, #6481a6) 283px)";

/**
 * The Apple menu as in the Apple-Menu screenshots, open under the menu bar: crop 0,44 of
 * 470 x 556 px. The first point of the box is the menu bar's shadow line; the menu hangs from
 * the bar's lower edge at x 10, 208 pt wide. The comparison hovers "About This Mac".
 */
export default function VisualAppleMenu() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setStage} style={{ position: "relative", width: 235, height: 278, background: sky }}>
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
          aria-label="Apple"
          style={{
            position: "absolute",
            left: 10,
            top: -22,
            width: 35,
            height: 22,
            padding: 0,
            border: 0,
            background: "none",
          }}
        />
        <MenuPopup attached container={stage} collisionPadding={0} style={{ width: 208 }}>
          <MenuItem data-testid="about">About This Mac</MenuItem>
          <MenuSeparator />
          <MenuItem>System Preferences…</MenuItem>
          <MenuItem>App Store…</MenuItem>
          <MenuSeparator />
          <Submenu>
            <SubmenuTrigger>Recent Items</SubmenuTrigger>
            <SubmenuPopup container={stage}>
              <MenuItem>Clear Menu</MenuItem>
            </SubmenuPopup>
          </Submenu>
          <MenuSeparator />
          <MenuItem keyEquivalent="option+command+escape">Force Quit…</MenuItem>
          <MenuSeparator />
          <MenuItem>Sleep</MenuItem>
          <MenuItem>Restart…</MenuItem>
          <MenuItem>Shut Down…</MenuItem>
          <MenuSeparator />
          <MenuItem keyEquivalent="control+command+q">Lock Screen</MenuItem>
          <MenuItem keyEquivalent="shift+command+q">Log Out Stephen…</MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}
