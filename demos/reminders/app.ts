import { Reminders } from "./reminders";
import { RemindersPreferences } from "./reminders-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks), open it at `defaultSize`, keep it at least `minSize`, and
 * show `menus` in the menu bar while it is the front application.
 */
export const remindersApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "reminders",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Reminders",
  /** The app as a window. */
  component: Reminders,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 768, height: 624 },
  /** The smallest frame at which the sidebar and a line of reminders keep their room. */
  minSize: { width: 520, height: 360 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Reminders", "File", "Edit", "View", "Window", "Help"],
  /** A list opens in a window of its own: a desktop gives it `DesktopWindow`. */
  windows: true,
  /** Reminders > Preferences: a window of its own. */
  preferences: { component: RemindersPreferences, defaultSize: { width: 420, height: 160 } },
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = remindersApp;

export type { RemindersProps } from "./reminders";
