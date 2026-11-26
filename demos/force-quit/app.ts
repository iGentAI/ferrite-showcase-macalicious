import { DesktopForceQuit } from "./force-quit";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, and show `menus` in the menu bar while it is in front.
 */
export const forceQuitApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "force-quit",
  /** The window's name: its title and its label where the demos are listed. */
  name: "Force Quit Applications",
  /**
   * The app as a window: on a desktop it lists the applications running there and quits the
   * one chosen (`managesApplications`); elsewhere it shows the captured list.
   */
  component: DesktopForceQuit,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 338, height: 307 },
  /** The window has one size. */
  resizable: false,
  /** It belongs to the system: it floats above the windows and the menu bar stays the front app's. */
  systemPanel: true,
  /** The window lists and quits the desktop's other applications. */
  managesApplications: true,
  /**
   * Menu titles after the Apple menu, for a desktop with no other window: Finder's, as captured.
   * The window belongs to the system, so while another application has a window the menu bar
   * keeps that application's menus.
   */
  menus: ["Finder", "File", "Edit", "View", "Go", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = forceQuitApp;

export type { ForceQuitProps } from "./force-quit";
