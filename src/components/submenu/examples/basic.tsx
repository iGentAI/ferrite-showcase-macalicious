import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";

export default function Basic() {
  return (
    <Menu>
      <MenuTrigger render={<PushButton>File</PushButton>} />
      <MenuPopup sideOffset={2}>
        <MenuItem keyEquivalent="command+n">New</MenuItem>
        <MenuItem keyEquivalent="command+o">Open…</MenuItem>
        <Submenu>
          <SubmenuTrigger>Open Recent</SubmenuTrigger>
          <SubmenuPopup>
            <MenuItem>Budget.numbers</MenuItem>
            <MenuItem>Letter.rtf</MenuItem>
            <MenuItem>Notes.txt</MenuItem>
            <MenuSeparator />
            <MenuItem>Clear Menu</MenuItem>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+w">Close</MenuItem>
      </MenuPopup>
    </Menu>
  );
}
