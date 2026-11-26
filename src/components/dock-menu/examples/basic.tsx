import { DockMenu, DockMenuPopup, DockMenuTrigger } from "macalicious/dock-menu";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";

export default function Basic() {
  return (
    <div style={{ display: "grid", justifyItems: "center", paddingBlockStart: 200 }}>
      <DockMenu>
        <DockMenuTrigger
          aria-label="Notes"
          style={{
            width: 48,
            height: 48,
            padding: 0,
            border: 0,
            borderRadius: 11,
            background: "var(--mac-color-system-yellow)",
          }}
        />
        <DockMenuPopup>
          <MenuItem>New Note</MenuItem>
          <MenuSeparator />
          <MenuCheckboxItem defaultChecked>Shopping List</MenuCheckboxItem>
          <MenuSeparator />
          <Submenu>
            <SubmenuTrigger>Options</SubmenuTrigger>
            <SubmenuPopup>
              <MenuCheckboxItem defaultChecked>Keep in Dock</MenuCheckboxItem>
              <MenuCheckboxItem>Open at Login</MenuCheckboxItem>
              <MenuItem>Show in Finder</MenuItem>
            </SubmenuPopup>
          </Submenu>
          <MenuSeparator />
          <MenuItem>Show All Windows</MenuItem>
          <MenuItem>Hide</MenuItem>
          <MenuItem>Quit</MenuItem>
        </DockMenuPopup>
      </DockMenu>
    </div>
  );
}
