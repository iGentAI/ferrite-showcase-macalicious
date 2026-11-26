import { HelpViewer } from "./help-viewer";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const helpViewerApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "help-viewer",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Help Viewer",
  /** The app as a window. */
  component: HelpViewer,
  /** The frame the window opens at, in points: the reference captures'. */
  defaultSize: { width: 877, height: 722 },
  /**
   * The smallest frame at which the toolbar's items fit and the page keeps its least width
   * (320 pt) beside the table of contents at the width it opens with (203 pt).
   */
  minSize: { width: 540, height: 300 },
  /** The window can be resized: the page takes the width the table of contents leaves. */
  resizable: true,
  /** File's row and Command-N: another window, with its own history. */
  newWindowTitle: "New Window",
  floats: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Help Viewer", "File", "Edit", "View", "Go", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = helpViewerApp;

export type { HelpViewerProps } from "./help-viewer";
