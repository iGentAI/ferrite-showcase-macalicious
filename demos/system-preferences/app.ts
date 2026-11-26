import { GRID_HEIGHT, WINDOW_WIDTH } from "./pane";
import { restoreSavedTheme } from "./storage";
import { SystemPreferences } from "./system-preferences";

/**
 * What a desktop page needs to host the application: render `component` (its root is the
 * library's `Window`; it takes the props a managed window's `render` form supplies and hands
 * the window controls' and the title bar's to those parts), open it at `defaultSize`, and show
 * `menus` in the menu bar while it is the front application.
 */
export const app = {
  id: "system-preferences",
  name: "System Preferences",
  component: SystemPreferences,
  /** The frame on the Show All grid; `onFrameSizeChange` reports the frame of every pane. */
  defaultSize: { width: WINDOW_WIDTH, height: GRID_HEIGHT },
  /** The window cannot be resized by the user and has no full screen: its zoom button is off. */
  resizable: false,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["System Preferences", "Edit", "View", "Window", "Help"],
  /**
   * Run by the desktop when it starts: on a desktop served by the `macalicious-desktop`
   * Ferrite application, the session's saved appearance and accent colour are set on the
   * page before System Preferences is opened.
   */
  onDesktopStart: restoreSavedTheme,
} as const;
