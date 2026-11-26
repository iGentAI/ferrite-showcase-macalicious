import { DesktopAutomator } from "./automator-desktop";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const automatorApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "automator",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Automator",
  /**
   * The app as a window: served by the `macalicious-desktop` Ferrite application it lists the
   * desktop's real actions, runs and saves workflows on the server, and does in the page what
   * asks the person or needs the browser; elsewhere the invented library and timed runs.
   */
  component: DesktopAutomator,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1000, height: 868 },
  /** The smallest frame at which the library, the workflow and the log keep their place. */
  minSize: { width: 700, height: 420 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Finder opens a workflow's file here; an Application's `.app` runs instead, unless Open With asks. */
  opens: ({ name }: { name: string }) => /\.(workflow|app)$/i.test(name),
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Automator", "File", "Edit", "View", "Workflow", "Action", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = automatorApp;

export type { AutomatorProps } from "./automator";
