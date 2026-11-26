import { Calendar } from "./calendar";
import { CalendarPreferences } from "./calendar-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const calendarApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "calendar",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Calendar",
  /** The app as a window. */
  component: Calendar,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1102, height: 624 },
  /** The smallest frame at which the toolbar keeps its three groups apart. */
  minSize: { width: 680, height: 420 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Finder opens iCalendar files here: the window imports them. */
  opens: (file: { name: string }) => /\.(ics|icbu)$/i.test(file.name),
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Calendar", "File", "Edit", "View", "Window", "Help"],
  /**
   * The app's second window, which Calendar > Preferences… (Command-comma, reported by the
   * main window's `onOpenPreferences`) opens. Its root is the library's `PreferencesWindow`;
   * give both windows the same `settings`, and the main one follows what this one changes.
   */
  preferences: {
    component: CalendarPreferences,
    /** The frame of the General pane, in points: the reference capture's. Not resizable. */
    defaultSize: { width: 537, height: 542 },
    /** Both windows take `settings`; this one reports a change in `onSettingsChange`. */
    sharesSettings: true,
  },
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = calendarApp;

export type { CalendarProps } from "./calendar";
export type { CalendarEntry, CalendarSettings, CalendarView } from "./calendar-data";
export type { CalendarPreferencesProps } from "./calendar-preferences";
