import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { useState } from "react";

/**
 * Fixture for the pixel checks of an open submenu, which no screenshot shows. A 150 pt menu
 * at 10,10 over the window background, whose second item is the parent of a submenu. The
 * comparison opens the submenu from the keyboard (Down, Down, Right).
 *
 * Parent menu: rows at y 14, 33 and 52. The submenu opens beside the parent row with its
 * hairline over the parent's (x 159) and its first row level with the parent row (y 33).
 */
export default function VisualOpen() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setStage} style={{ position: "relative", width: 320, height: 100 }}>
      <Menu defaultOpen modal={false}>
        <MenuTrigger
          aria-label="File"
          style={{
            position: "absolute",
            left: 10,
            top: 0,
            width: 150,
            height: 10,
            padding: 0,
            border: 0,
            background: "none",
          }}
        />
        <MenuPopup container={stage} collisionPadding={0} style={{ width: 150 }}>
          <MenuItem>New</MenuItem>
          <Submenu>
            <SubmenuTrigger>Open Recent</SubmenuTrigger>
            <SubmenuPopup container={stage} collisionPadding={0} style={{ width: 140 }}>
              <MenuItem>Letter.rtf</MenuItem>
              <MenuItem>Notes.txt</MenuItem>
            </SubmenuPopup>
          </Submenu>
          <MenuItem>Close</MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}
