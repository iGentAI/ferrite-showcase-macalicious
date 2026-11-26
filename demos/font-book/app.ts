import { FontBook } from "./font-book";
import { startFontPanelFonts } from "./font-book-panel-fonts";
import { FontBookPreferences } from "./font-book-preferences";
import { isFontFile } from "./font-book-tables";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const fontBookApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "font-book",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Font Book",
  /** The app as a window. */
  component: FontBook,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1017, height: 603 },
  /** The smallest frame at which the toolbar's items fit and the panes keep their least widths. */
  minSize: { width: 640, height: 320 },
  /** The window can be resized: the preview takes the width the two lists leave. */
  resizable: true,
  /** The application's Preferences, a second window of the desktop. */
  preferences: { component: FontBookPreferences, defaultSize: { width: 520, height: 300 } },
  /** Finder opens font files here: the window offers to install one. */
  opens: ({ name }: { name: string }) => isFontFile(name),
  /** The fonts the person added are the computer's: every Fonts panel lists them. */
  onDesktopStart: startFontPanelFonts,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Font Book", "File", "Edit", "View", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = fontBookApp;

export type { FontBookProps } from "./font-book";
