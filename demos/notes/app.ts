import { Notes } from "./notes";
import { NotesMenuBar } from "./notes-menus";
import { NotesPreferences } from "./notes-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application. `menuBar` is that menu bar with the commands the demo has; it
 * takes the functions the component puts in its `actionsRef`.
 */
export const notesApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "notes",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Notes",
  /** The app as a window. */
  component: Notes,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1000, height: 666 },
  /** The smallest frame at which the toolbar's groups and the three panes still fit. */
  minSize: { width: 1000, height: 300 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Notes", "File", "Edit", "Format", "View", "Window", "Help"],
  /** The menu bar of the app, with New Note and the Format commands. */
  menuBar: NotesMenuBar,
  /** The Share menu of files lists Notes. */
  takesSharedFiles: true,
  /** Finder's Open With and the Dock tile: a file becomes a new note. A double click never picks it. */
  opens: () => true,
  opensOnlyWhenAsked: true,
  /** A note opens in a window of its own. */
  windows: true,
  /** Services > New Note With Selection. */
  takesSharedText: true,
  /** The window that Notes > Preferences opens, a second window of a desktop. */
  preferences: { component: NotesPreferences, defaultSize: { width: 460, height: 262 } },
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = notesApp;

export type { NotesContentProps, NotesProps } from "./notes";
export { NotesContent } from "./notes";
export type { NotesActions, NotesMenuBarProps, NotesStatus } from "./notes-menus";
