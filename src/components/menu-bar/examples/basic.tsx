import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";

/** A stand-in for the mark of the Apple menu, which is Apple's and is not shipped. */
function Mark() {
  return (
    <svg width="15" height="16" viewBox="0 0 15 16" fill="currentColor" aria-hidden="true">
      <circle cx="7.5" cy="8.5" r="6" />
    </svg>
  );
}

export default function Basic() {
  return (
    <MenuBar modal={false} style={{ width: 420 }}>
      <MenuBarMenu title={<Mark />} aria-label="System">
        <MenuItem>About This Computer</MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="control+command+q">Lock Screen</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="Notes" application>
        <MenuItem>About Notes</MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+,">Preferences…</MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+q">Quit Notes</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="File">
        <MenuItem keyEquivalent="command+n">New Note</MenuItem>
        <MenuItem keyEquivalent="shift+command+n">New Folder</MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+w">Close</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="Edit">
        <MenuItem keyEquivalent="command+z" disabled>
          Undo
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+x">Cut</MenuItem>
        <MenuItem keyEquivalent="command+c">Copy</MenuItem>
        <MenuItem keyEquivalent="command+v">Paste</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="View">
        <MenuCheckboxItem defaultChecked>Show Folders</MenuCheckboxItem>
        <MenuCheckboxItem>Show Attachments Browser</MenuCheckboxItem>
      </MenuBarMenu>
      <MenuBarMenu title="Window" disabled>
        <MenuItem>Minimize</MenuItem>
      </MenuBarMenu>
    </MenuBar>
  );
}
