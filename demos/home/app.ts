import { Home } from "./home";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const homeApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "home",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Home",
  /** The app as a window. */
  component: Home,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 914, height: 768 },
  /** The smallest frame at which the toolbar's three items fit and a row of tiles shows. */
  minSize: { width: 600, height: 400 },
  /** The window can be resized: the tiles wrap, and the segmented control stays centred. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Home", "File", "Edit", "View", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = homeApp;

export type { HomeProps } from "./home";
