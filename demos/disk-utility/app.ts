import { DiskUtility } from "./disk-utility";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const diskUtilityApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "disk-utility",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Disk Utility",
  /** The app as a window. */
  component: DiskUtility,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 926, height: 571 },
  /** The smallest frame at which the toolbar's items keep apart and the table its columns. */
  minSize: { width: 780, height: 400 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Disk Utility", "File", "Edit", "Images", "View", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = diskUtilityApp;

export type { DiskUtilityProps } from "./disk-utility";
