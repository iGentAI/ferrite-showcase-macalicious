import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem } from "macalicious/menu-item";
import { ToolbarSearchField, ToolbarSearchFieldMenuButton } from "macalicious/toolbar-search-field";
import { useState } from "react";

const SCOPES = ["Everything", "Family", "Style", "PostScript Name"];

/**
 * A search menu, as in Font Book: the magnifier is a button with a chevron that opens a menu
 * of what the field searches. The button is the menu's trigger; the application keeps the
 * choice and shows it in the placeholder.
 */
export default function SearchMenu() {
  const [scope, setScope] = useState(SCOPES[0]);
  return (
    <div style={{ padding: 12, background: "var(--mac-material-titlebar)" }}>
      <Menu>
        <ToolbarSearchField
          aria-label="Search fonts"
          placeholder={scope === SCOPES[0] ? "Search" : scope}
          style={{ width: 240 }}
          searchMenu={
            <MenuTrigger render={<ToolbarSearchFieldMenuButton aria-label="Search in" />} />
          }
        />
        <MenuPopup>
          {SCOPES.map((name) => (
            <MenuItem key={name} onClick={() => setScope(name)}>
              {name}
            </MenuItem>
          ))}
        </MenuPopup>
      </Menu>
    </div>
  );
}
