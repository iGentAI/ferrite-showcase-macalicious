import { DesktopNetworkUtility } from "./network-utility-desktop";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, and show `menus` in the menu bar while it is the front
 * application.
 */
export const networkUtilityApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "network-utility",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Network Utility",
  /**
   * The app as a window: served by the `macalicious-desktop` Ferrite application its Lookup and
   * Whois ask real services, Ping times labelled HTTPS requests, and the other tools say what they
   * cannot do; elsewhere the demo's made-up output.
   */
  component: DesktopNetworkUtility,
  /** The frame of the window, in points: the reference capture's. */
  defaultSize: { width: 644, height: 385 },
  /** The layout is fixed, as in the application: the window keeps its size. */
  resizable: false,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Network Utility", "File", "Edit", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = networkUtilityApp;

export type { NetworkUtilityProps } from "./network-utility";
export type {
  NetworkUtilityInterface,
  NetworkUtilityTab,
  NetworkUtilityTool,
} from "./network-utility-data";
