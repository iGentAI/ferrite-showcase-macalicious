import { AppStore } from "./app-store";
import { AppStorePreferences } from "./app-store-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`; it takes the props a managed window's `render` form supplies and
 * hands the window controls' to that part and the drag region's to the top of its sidebar),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const appStoreApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "app-store",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "App Store",
  /** The app as a window. */
  component: AppStore,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1246, height: 857 },
  /** The smallest frame at which the 220 pt sidebar and one column of lockups still fit. */
  minSize: { width: 760, height: 480 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["App Store", "Edit", "Store", "Window", "Help"],
  /** The Preferences window, which the application menu's Preferences… and Command-comma open. */
  preferences: { component: AppStorePreferences, defaultSize: { width: 480, height: 220 } },
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = appStoreApp;

export type { AppStoreProps } from "./app-store";
export type { AppStoreApp, AppStoreSection } from "./app-store-data";
