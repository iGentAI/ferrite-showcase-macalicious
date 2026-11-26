import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";

export default function Basic() {
  return (
    <Menu>
      <MenuTrigger render={<PushButton>Actions</PushButton>} />
      <MenuPopup sideOffset={2}>
        <MenuItem keyEquivalent="command+n">New Folder</MenuItem>
        <MenuItem keyEquivalent="command+i">Get Info</MenuItem>
        <MenuItem disabled>Rename</MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+delete">Move to Trash</MenuItem>
      </MenuPopup>
    </Menu>
  );
}
