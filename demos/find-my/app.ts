import { DesktopFindMy } from "./find-my-desktop";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const findMyApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "find-my",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Find My",
  /**
   * The app as a window: served by the `macalicious-desktop` Ferrite application it shows
   * OpenStreetMap's real map, this browser's location and the person's devices with Play Sound;
   * elsewhere the demo over its abstract drawing.
   */
  component: DesktopFindMy,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1135, height: 723 },
  /** The smallest frame that keeps the two groups of map controls apart beside the sidebar. */
  minSize: { width: 680, height: 360 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Find My", "File", "Edit", "View", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = findMyApp;

export type { FindMyProps } from "./find-my";
export type {
  FindMyDevice,
  FindMyDeviceKind,
  FindMyList,
  FindMyMapType,
  FindMyPerson,
  FindMyPoint,
} from "./find-my-data";
