import { AirPortUtility } from "./airport-utility";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const airportUtilityApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "airport-utility",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "AirPort Utility",
  /** The app as a window: the graph of the network. */
  component: AirPortUtility,
  /** The frame the window opens at, in points: the reference captures'. */
  defaultSize: { width: 696, height: 532 },
  /** The smallest frame that holds the Internet and a row of base stations under it. */
  minSize: { width: 560, height: 440 },
  /** The window can be resized. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["AirPort Utility", "File", "Edit", "Base Station", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = airportUtilityApp;

export type { AirPortUtilityProps } from "./airport-utility";
