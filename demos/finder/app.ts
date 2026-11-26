import { Finder } from "./finder";
import { FinderPreferences } from "./finder-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the title bar's callbacks), open it at `defaultSize`, keep it at least `minSize`, and
 * show `menus` in the menu bar while it is the front application.
 */
export const finderApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "finder",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Finder",
  /** The app as a window. */
  component: Finder,
  /** The frame the window opens at, in points: the Applications capture's. */
  defaultSize: { width: 1080, height: 756 },
  /** The smallest frame at which the toolbar keeps all of its items. */
  minSize: { width: 720, height: 320 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Finder", "File", "Edit", "View", "Go", "Window", "Help"],
  /**
   * The window opens an Info window and Quick Look: a desktop gives it `DesktopWindow`, and
   * each is then a window of that desktop.
   */
  windows: true,
  /** Finder's Preferences, a second window of the desktop. */
  preferences: { component: FinderPreferences, defaultSize: { width: 420, height: 360 } },
  newWindowTitle: "New Finder Window",
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = finderApp;

export type { FinderProps } from "./finder";
