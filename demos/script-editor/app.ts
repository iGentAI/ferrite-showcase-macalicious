import { ScriptEditor } from "./script-editor";
import { ScriptEditorPreferences } from "./script-editor-preferences";
import { isScriptFile } from "./script-editor-server";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const scriptEditorApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "script-editor",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Script Editor",
  /**
   * The app as a window per script. Served by the `macalicious-desktop` Ferrite application it
   * runs JavaScript on the server and opens and saves scripts in the person's drive.
   */
  component: ScriptEditor,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 700, height: 705 },
  /** The smallest frame that keeps the toolbar's buttons apart and a few lines of each view. */
  minSize: { width: 360, height: 300 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** File > New and Command-N open another window, with a script of its own. */
  newWindowTitle: "New",
  /** What Finder and the Dock tile open here (`takeOpenFileRequests`). */
  opens: isScriptFile,
  /** The Library, each Dictionary and the Log History are windows of the desktop. */
  windows: true,
  /** Script Editor > Preferences, hosted by the desktop beside the windows. */
  preferences: { component: ScriptEditorPreferences, defaultSize: { width: 460, height: 300 } },
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Script Editor", "File", "Edit", "View", "Script", "Font", "Format", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = scriptEditorApp;

export type { ScriptEditorProps, ScriptEditorView } from "./script-editor";
export type { ScriptLanguage, ScriptRun, ScriptStyle } from "./script-editor-data";
export type { ScriptEditorServer } from "./script-editor-server";
