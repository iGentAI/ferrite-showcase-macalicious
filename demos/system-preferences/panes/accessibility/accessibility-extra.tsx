"use client";

import { MenuBarExtraMenu } from "macalicious/menu-bar-extra";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import {
  changeDesktopValue,
  readBoolean,
  useDesktopValue,
} from "../../../desktop/desktop-personal";
import {
  CONTRAST_KEY,
  GRAYSCALE_KEY,
  INVERT_KEY,
  REDUCE_MOTION_KEY,
  REDUCE_TRANSPARENCY_KEY,
} from "./page-accessibility";

export const SHOW_IN_MENU_BAR_KEY = "accessibility.showStatusInMenuBar";

function Toggle({ setting, children }: { setting: string; children: string }) {
  const on = useDesktopValue(setting, readBoolean, false);
  return (
    <MenuCheckboxItem
      checked={on}
      onCheckedChange={(checked) => changeDesktopValue(setting, checked)}
    >
      {children}
    </MenuCheckboxItem>
  );
}

/** The person in a circle, as a menu bar glyph. */
function AccessibilityGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8 .5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15ZM8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm0 1a1.2 1.2 0 1 1 0 2.4A1.2 1.2 0 0 1 8 3Zm-3.6 3 2.6.5h2l2.6-.5.2 1-2.6.6v1.6l.9 3.1-1 .3L8.2 10h-.4l-.9 2.6-1-.3.9-3.1V7.6L4.2 7l.2-1Z"
      />
    </svg>
  );
}

/**
 * Show Accessibility status in menu bar: the settings of this page to hand, and the pane. It is
 * nothing until the person turns it on.
 */
export function AccessibilityExtra({ preferences }: { preferences: (pane: string) => void }) {
  const shown = useDesktopValue(SHOW_IN_MENU_BAR_KEY, readBoolean, false);
  if (!shown) return null;
  return (
    <MenuBarExtraMenu
      aria-label="Accessibility"
      titleProps={{ style: { width: 30, justifyContent: "center", padding: 0 } }}
      title={<AccessibilityGlyph />}
    >
      <Toggle setting={INVERT_KEY}>Invert colors</Toggle>
      <Toggle setting={GRAYSCALE_KEY}>Use grayscale</Toggle>
      <Toggle setting={CONTRAST_KEY}>Increase contrast</Toggle>
      <Toggle setting={REDUCE_MOTION_KEY}>Reduce motion</Toggle>
      <Toggle setting={REDUCE_TRANSPARENCY_KEY}>Reduce transparency</Toggle>
      <MenuSeparator />
      <MenuItem onClick={() => preferences("accessibility")}>
        Open Accessibility Preferences…
      </MenuItem>
    </MenuBarExtraMenu>
  );
}
