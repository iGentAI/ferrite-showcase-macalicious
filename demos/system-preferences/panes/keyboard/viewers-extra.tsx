"use client";

import { MenuBarExtraMenu } from "macalicious/menu-bar-extra";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { toggleCharacterViewer } from "../../../desktop/desktop-characters";
import { readBoolean, useDesktopValue } from "../../../desktop/desktop-personal";

/** Stand-in for the menu bar's viewers glyph: an original drawing of a key with a smile. */
function ViewersGlyph() {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true" focusable="false">
      <rect
        x="0.75"
        y="0.75"
        width="14.5"
        height="12.5"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="5.5" cy="5" r="1" fill="currentColor" />
      <circle cx="10.5" cy="5" r="1" fill="currentColor" />
      <path
        d="M4.5 8.5a3.8 3.8 0 0 0 7 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Keyboard's "Show keyboard and emoji viewers in menu bar": the desktop's character viewer. */
export function ViewersMenuExtra({ onPreferences }: { onPreferences: () => void }) {
  if (!useDesktopValue("keyboard.showViewers", readBoolean, false)) return null;
  return (
    <MenuBarExtraMenu
      aria-label="Viewers"
      titleProps={{ style: { width: 30, justifyContent: "center", padding: 0 } }}
      title={<ViewersGlyph />}
    >
      <MenuItem onClick={toggleCharacterViewer}>Emoji &amp; Symbols</MenuItem>
      <MenuItem disabled title="This desktop draws no keyboard viewer.">
        Keyboard Viewer
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={onPreferences}>Open Keyboard Preferences…</MenuItem>
    </MenuBarExtraMenu>
  );
}
