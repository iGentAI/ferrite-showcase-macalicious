import { Safari } from "./safari";
import { isLinkFile, isPageFile } from "./safari-files";
import { SafariPreferences } from "./safari-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const safariApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "safari",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Safari",
  /** The app as a window. */
  component: Safari,
  /** The frame the window opens at, in points: the Dark Aqua capture's. */
  defaultSize: { width: 1254, height: 903 },
  /** The smallest frame at which the toolbar's items still fit. */
  minSize: { width: 575, height: 300 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  newWindowTitle: "New Window",
  /**
   * Finder opens saved links here, and offers an HTML file under Open With: TextEdit opens that
   * first, as `finder-open.ts` has it.
   */
  opens: (file: { name: string }) => isLinkFile(file) || isPageFile(file),
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Safari", "File", "Edit", "View", "History", "Bookmarks", "Window", "Help"],
  /**
   * The window that Safari > Preferences opens, as a second window of a desktop: its root is
   * the library's `PreferencesWindow`, which sizes itself to the selected pane and is not
   * resizable. `defaultSize` is its frame in points when it opens, on its first pane; the
   * width stays and the height follows the pane.
   */
  preferences: { component: SafariPreferences, defaultSize: { width: 774, height: 508 } },
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = safariApp;
