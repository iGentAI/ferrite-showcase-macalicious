import { DesktopAboutThisMac } from "./about-this-mac-desktop";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's about window, a `Window`, and it takes that window's props together with the
 * window controls' and the drag region's callbacks, which are the props a managed window's
 * `render` supplies), open it at `defaultSize`, and show `menus` in the menu bar while it is
 * the front application.
 */
export const aboutThisMacApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "about-this-mac",
  /** The window's name: its Dock label. */
  name: "About This Mac",
  /**
   * The app as a window: served by the `macalicious-desktop` Ferrite application it shows only
   * what that application and the browser can know; elsewhere the captured Mac.
   */
  component: DesktopAboutThisMac,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 586, height: 353 },
  /** The window has a fixed size: its zoom button is disabled. */
  resizable: false,
  /**
   * Menu titles after the Apple menu. About This Mac has no menus of its own: the capture
   * shows Finder's, the application that is frontmost behind it.
   */
  menus: ["Finder", "File", "Edit", "View", "Go", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = aboutThisMacApp;

export type { AboutThisMacProps } from "./about-this-mac";
