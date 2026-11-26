import { desktopValues } from "./desktop-personal";

/**
 * Dock's Prefer tabs when opening documents, for Terminal, the application on this desktop whose
 * windows hold tabs and that has no setting of its own for them: with Always, or In Full Screen Only
 * while the key window is in full screen, its New Window opens a tab. Finder and Safari have settings
 * of their own, as on a Mac.
 */
export const PREFER_TABS = "dock.preferTabs";

let keyWindowFullScreen = false;

/** For the desktop: whether the key window is in full screen now. */
export function noteKeyWindowFullScreen(fullScreen: boolean): void {
  keyWindowFullScreen = fullScreen;
}

/** Whether a command that opens a window should open a tab instead. */
export function tabsPreferred(): boolean {
  const chosen = desktopValues()[PREFER_TABS];
  return chosen === "Always" || (chosen !== "Manually" && keyWindowFullScreen);
}
