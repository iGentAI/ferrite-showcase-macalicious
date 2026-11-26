import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { SystemImage } from "macalicious/system-image";
import { ToolbarPullDown } from "macalicious/toolbar-pop-up";

export default function Basic() {
  return (
    <ToolbarPullDown image={<SystemImage name="action" scale={14 / 13} />} aria-label="Action">
      <MenuItem>New Folder</MenuItem>
      <MenuItem>Get Info</MenuItem>
      <MenuSeparator />
      <MenuItem>Show View Options</MenuItem>
    </ToolbarPullDown>
  );
}
