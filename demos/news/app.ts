import { News } from "./news";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const newsApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "news",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "News",
  /** The app as a window. */
  component: News,
  /** The frame the window opens at, in points: the Aqua reference capture's. */
  defaultSize: { width: 1222, height: 842 },
  /** The smallest frame: the sidebar and a pane wide enough for two stories to a row. */
  minSize: { width: 760, height: 420 },
  /** The window can be resized: the feed's column stays centred in the pane and narrows with it. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["News", "File", "Edit", "View", "Story", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = newsApp;

export type { NewsProps } from "./news";
