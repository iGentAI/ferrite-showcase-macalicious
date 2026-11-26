import { DesktopKeychainAccess } from "./keychain-access-desktop";
import { KeychainAccessPreferences } from "./keychain-access-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const keychainAccessApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "keychain-access",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Keychain Access",
  /**
   * The app as a window: served by the `macalicious-desktop` Ferrite application it holds the
   * person's own keychain, encrypted in the browser; elsewhere the invented keychains.
   */
  component: DesktopKeychainAccess,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 877, height: 593 },
  /** The smallest frame at which both lists and the first columns of the table stay in view. */
  minSize: { width: 560, height: 320 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Keychain Access", "File", "Edit", "View", "Window", "Help"],
  /** The status in the menu bar, and what cannot be changed here with why. */
  preferences: { component: KeychainAccessPreferences, defaultSize: { width: 420, height: 230 } },
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = keychainAccessApp;

export type { KeychainAccessProps } from "./keychain-access";
