import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuBarExtra, MenuBarExtraMenu, MenuBarExtras } from "macalicious/menu-bar-extra";
import { MenuCheckboxItem, MenuItem, MenuSection, MenuSeparator } from "macalicious/menu-item";
import { useState } from "react";

/** Stand-ins for the system's template images, which are Apple's and are not shipped. */
function Battery() {
  return (
    <svg width="23" height="12" viewBox="0 0 23 12" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="19" height="11" rx="2.5" stroke="currentColor" />
      <rect x="2" y="2" width="12" height="8" rx="1" fill="currentColor" />
      <rect x="21" y="4" width="2" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}

function Magnifier() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m9 9 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Basic() {
  const [searching, setSearching] = useState(false);
  return (
    <MenuBar
      modal={false}
      style={{ width: 420 }}
      extras={
        <MenuBarExtras modal={false}>
          <MenuBarExtraMenu title={<Battery />} aria-label="Battery">
            <MenuItem disabled>Power Source: Battery</MenuItem>
            <MenuSeparator />
            <MenuSection title="Using Significant Energy">
              <MenuItem>Spotlight</MenuItem>
            </MenuSection>
            <MenuSeparator />
            <MenuCheckboxItem defaultChecked>Show Percentage</MenuCheckboxItem>
          </MenuBarExtraMenu>
          <MenuBarExtraMenu title="Thu 10:07 AM">
            <MenuItem disabled>Thursday, October 10, 2019</MenuItem>
            <MenuSeparator />
            <MenuItem>Open Date &amp; Time Preferences…</MenuItem>
          </MenuBarExtraMenu>
          <MenuBarExtraMenu title="Stephen">
            <MenuItem>Login Window…</MenuItem>
            <MenuSeparator />
            <MenuItem>Users &amp; Groups Preferences…</MenuItem>
          </MenuBarExtraMenu>
          <MenuBarExtra
            aria-label="Search"
            active={searching}
            onClick={() => setSearching((on) => !on)}
          >
            <Magnifier />
          </MenuBarExtra>
        </MenuBarExtras>
      }
    >
      <MenuBarMenu title="Notes" application>
        <MenuItem>About Notes</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="File">
        <MenuItem keyEquivalent="command+n">New Note</MenuItem>
      </MenuBarMenu>
    </MenuBar>
  );
}
