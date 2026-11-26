import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { useState } from "react";

/**
 * The sky of the Catalina desktop picture behind the Finder menu, as a gradient of the
 * colours down one column of the Desktop screenshots. A stand-in for the picture, which is
 * Apple's and is not shipped.
 */
const sky =
  "linear-gradient(light-dark(#5f94c3, #27446f) 2px, light-dark(#6ba2d3, #27446f) 14px, light-dark(#75aedf, #26436c) 27px, light-dark(#81b9ec, #26416a) 40px, light-dark(#8abeee, #25426b) 52px, light-dark(#81bded, #294771) 86px, light-dark(#8dc6f3, #314e79) 125px, light-dark(#93caf4, #3a5883) 151px, light-dark(#a1d1f7, #47668f) 188px, light-dark(#aed9f9, #4a6a92) 223px)";

/**
 * Finder's application menu as in the Finder-Menu screenshots: crop 70,44 of 398 x 398 px.
 * The menu hangs from the menu bar's lower edge at x 10 and is 179 pt wide. In the Aqua
 * capture the Trash is empty, so Empty Trash is disabled; the Dark Aqua capture has it enabled
 * (see `visual-finder-menu-full-trash`). The comparison hovers "About Finder".
 */
export function FinderMenu({ trashEmpty }: { trashEmpty: boolean }) {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setStage} style={{ position: "relative", width: 199, height: 199, background: sky }}>
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
          aria-label="Finder"
          style={{
            position: "absolute",
            left: 10,
            top: -22,
            width: 62,
            height: 22,
            padding: 0,
            border: 0,
            background: "none",
          }}
        />
        <MenuPopup attached container={stage} collisionPadding={0} style={{ width: 179 }}>
          <MenuItem data-testid="about">About Finder</MenuItem>
          <MenuSeparator />
          <MenuItem keyEquivalent="command+,">Preferences…</MenuItem>
          <MenuSeparator />
          <MenuItem keyEquivalent="shift+command+delete" disabled={trashEmpty}>
            Empty Trash…
          </MenuItem>
          <MenuSeparator />
          <Submenu>
            <SubmenuTrigger>Services</SubmenuTrigger>
            <SubmenuPopup container={stage}>
              <MenuItem disabled>No Services Apply</MenuItem>
            </SubmenuPopup>
          </Submenu>
          <MenuSeparator />
          <MenuItem keyEquivalent="command+h" disabled>
            Hide Finder
          </MenuItem>
          <MenuItem keyEquivalent="option+command+h" disabled>
            Hide Others
          </MenuItem>
          <MenuItem disabled>Show All</MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}

export default function VisualFinderMenu() {
  return <FinderMenu trashEmpty />;
}
