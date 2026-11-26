import { TextEdit, TextEditMenuBar } from "./textedit";
import { TextEditPreferences } from "./textedit-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application. `menuBar` is that menu bar with the commands the demo has; it
 * takes the functions the component puts in its `actionsRef`.
 */
export const texteditApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "textedit",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "TextEdit",
  /** The app as a window: one document. Further windows open through `newWindow` (`textedit-windows.ts`). */
  component: TextEdit,
  /** The frame the window opens at, in points: the Aqua reference capture's. */
  defaultSize: { width: 624, height: 537 },
  /** The smallest frame that still shows the whole format bar and a few lines of text. */
  minSize: { width: 552, height: 160 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["TextEdit", "File", "Edit", "Format", "View", "Window", "Help"],
  /** The window that TextEdit > Preferences opens, a second window of a desktop. */
  preferences: {
    component: TextEditPreferences,
    title: "Preferences",
    defaultSize: { width: 500, height: 540 },
  },
  /** The menu bar of the app, with its File and Format commands. */
  menuBar: TextEditMenuBar,
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = texteditApp;

export type {
  TextEditActions,
  TextEditDialog,
  TextEditMenuBarProps,
  TextEditProps,
  TextEditStatus,
} from "./textedit";
export type { TextEditDocument, TextEditFile, TextEditPlace } from "./textedit-data";
