import { Books } from "./books";
import { bookFileKind } from "./books-import";
import { BooksPreferences } from "./books-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`; it takes the props a managed window's `render` form supplies and
 * hands the window controls' to that part and the drag region's to its title bar), open it at
 * `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while it is the
 * front application.
 */
export const booksApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "books",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Books",
  /** The app as a window: the library, which opens a book's window beside itself. */
  component: Books,
  /** The frame the library window opens at, in points: the reference captures'. */
  defaultSize: { width: 1184, height: 784 },
  /**
   * The smallest frame at which the toolbar's three items keep their measured widths with the
   * control centred, and the 220 pt sidebar leaves room for two columns of covers.
   */
  minSize: { width: 760, height: 420 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Books > Preferences, hosted by the desktop beside the library. */
  preferences: { component: BooksPreferences, defaultSize: { width: 420, height: 130 } },
  /** Finder opens an EPUB here, and lists Books under Open With for a PDF. */
  opens: (file: { name: string; type?: string }) => bookFileKind(file) !== null,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Books", "File", "Edit", "View", "Controls", "Store", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = booksApp;

export { type BooksProps, BooksReader, type BooksReaderProps } from "./books";
export type {
  BooksBook,
  BooksCollection,
  BooksSection,
  BooksSort,
  BooksView,
} from "./books-data";
