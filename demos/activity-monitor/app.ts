import { DesktopActivityMonitor } from "./activity-monitor-desktop";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const activityMonitorApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "activity-monitor",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Activity Monitor",
  /**
   * The app as a window: served by the `macalicious-desktop` Ferrite application it lists the
   * desktop's own applications and windows and the requests that application counted;
   * elsewhere the invented processes.
   */
  component: DesktopActivityMonitor,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 839, height: 634 },
  /** The smallest frame at which the toolbar keeps its three groups apart. */
  minSize: { width: 640, height: 300 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** The window lists the running applications, and opens an inspector and two CPU windows. */
  windows: true,
  /**
   * it is given `runningApplications` and `onQuitApplication` for that.
   */
  managesApplications: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Activity Monitor", "File", "Edit", "View", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = activityMonitorApp;

export type { ActivityMonitorProps } from "./activity-monitor";
