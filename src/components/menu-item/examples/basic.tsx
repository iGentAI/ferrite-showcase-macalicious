import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSection,
  MenuSeparator,
} from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { useState } from "react";

export default function Basic() {
  const [view, setView] = useState("icons");
  const [pathBar, setPathBar] = useState(true);
  return (
    <Menu>
      <MenuTrigger render={<PushButton>View</PushButton>} />
      <MenuPopup sideOffset={2}>
        <MenuRadioGroup value={view} onValueChange={setView}>
          <MenuRadioItem value="icons" keyEquivalent="command+1">
            as Icons
          </MenuRadioItem>
          <MenuRadioItem value="list" keyEquivalent="command+2">
            as List
          </MenuRadioItem>
          <MenuRadioItem value="columns" keyEquivalent="command+3">
            as Columns
          </MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuCheckboxItem
          checked={pathBar}
          onCheckedChange={setPathBar}
          keyEquivalent="option+command+p"
        >
          Show Path Bar
        </MenuCheckboxItem>
        <MenuItem disabled>Show Preview</MenuItem>
        <MenuSeparator />
        <MenuSection title="Sort By">
          <MenuItem>Name</MenuItem>
          <MenuItem>Date Modified</MenuItem>
        </MenuSection>
      </MenuPopup>
    </Menu>
  );
}
