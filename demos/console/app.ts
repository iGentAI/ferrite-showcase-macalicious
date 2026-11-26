import { DesktopConsole } from "./console-desktop";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const consoleApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "console",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Console",
  /**
   * The app as a window: served by the `macalicious-desktop` Ferrite application it shows that
   * application's own log; elsewhere the invented messages.
   */
  component: DesktopConsole,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1000, height: 500 },
  /** The smallest frame at which the toolbar keeps its search field and the table its rows. */
  minSize: { width: 620, height: 300 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Finder opens logs, crash reports and spin reports here. */
  opens: (file: { name: string }) => /\.(log|out|err|crash|ips|diag|spin)$/i.test(file.name),
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Console", "File", "Edit", "Action", "View", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = consoleApp;

export type { ConsoleProps } from "./console";
