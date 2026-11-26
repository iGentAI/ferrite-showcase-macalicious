import { DesktopDictionary, startLookUp } from "./dictionary-desktop";
import { DictionaryPreferences } from "./dictionary-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const dictionaryApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "dictionary",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Dictionary",
  /**
   * The app as a window: the demo's vocabulary, or real look-ups when the desktop's Ferrite
   * application serves it (`dictionary-desktop.tsx`).
   */
  component: DesktopDictionary,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 690, height: 650 },
  /** The smallest frame that keeps the toolbar's controls and the scope bar's scopes apart. */
  minSize: { width: 480, height: 240 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** The File menu's New Window and Command-N: each window has its own search and history. */
  newWindowTitle: "New Window",
  /** Which sources are shown in what order, and the size of the text. */
  preferences: { component: DictionaryPreferences, defaultSize: { width: 420, height: 320 } },
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Dictionary", "File", "Edit", "View", "Go", "Window", "Help"],
  /** Look Up for the whole desktop: Control-Command-D shows the selected text in Dictionary. */
  onDesktopStart: startLookUp,
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = dictionaryApp;

export type { DictionaryProps } from "./dictionary";
export type {
  DictionaryArticle,
  DictionaryCredit,
  DictionaryEntry,
  DictionaryPart,
  DictionaryScope,
  DictionarySense,
  DictionarySource,
  DictionaryThesaurus,
} from "./dictionary-data";
