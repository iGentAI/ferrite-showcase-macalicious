import { DesktopMaps } from "./maps-desktop";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const mapsApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "maps",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Maps",
  /**
   * The app as a window: served by the `macalicious-desktop` Ferrite application it shows
   * OpenStreetMap's real map with search, pins and the person's places; elsewhere the
   * demo over its abstract drawing.
   */
  component: DesktopMaps,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1000, height: 690 },
  /** The smallest frame that keeps the toolbar's controls apart and the map's controls clear. */
  minSize: { width: 640, height: 320 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** File > New Window and Command-N: each window has its own map, and the person's places. */
  newWindowTitle: "New Window",
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Maps", "File", "Edit", "View", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = mapsApp;

export type { MapsProps } from "./maps";
export type {
  MapsLink,
  MapsMapType,
  MapsPlace,
  MapsPoint,
  MapsRegion,
  MapsWeather,
} from "./maps-data";
