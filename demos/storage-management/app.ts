import { DesktopStorageManagement } from "./storage-management-desktop";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const storageManagementApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "storage-management",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Storage Management",
  /**
   * The app as a window: served by the `macalicious-desktop` Ferrite application it reports what
   * this browser's session keeps on the server; elsewhere the captured Mac's disk.
   */
  component: DesktopStorageManagement,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 801, height: 532 },
  /** The smallest frame that keeps a recommendation's text beside its button. */
  minSize: { width: 640, height: 320 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Storage Management", "File", "Edit", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = storageManagementApp;

export type { StorageManagementProps } from "./storage-management";
