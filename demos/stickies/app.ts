import { StickiesDesktopNote } from "./stickies";
import { defaultStickies } from "./stickies-data";

/**
 * What a desktop page needs to list, launch and host the app. Stickies has no document window:
 * its windows are its notes. `component` is one note, a `StickiesNote` that the
 * macalicious-desktop Ferrite application saves (`StickiesDesktopNote`); its root is the
 * library's `StickyNote`,
 * a window of its own, and it takes the props of a `Window` together with the window controls'
 * and the drag region's props, which are the props a managed window's `render` supplies. Open
 * it at `defaultSize`, keep a note at least `minSize`, and show `menus` in the menu bar while it
 * is the front application. With `windows`, the desktop gives the note `DesktopWindow`, through
 * which it opens every other saved note as a window of its own, each at its saved frame, and its
 * Fonts and Colors panels as utility panels of the desktop.
 */
export const stickiesApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "stickies",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Stickies",
  /** One note, as a window. */
  component: StickiesDesktopNote,
  /** The frame a note opens at, in points: the yellow note of the reference captures. */
  defaultSize: { width: 352, height: 260 },
  /** The smallest note that still shows its three widgets and a line of text. */
  minSize: { width: 120, height: 48 },
  /** A note can be resized; its zoom box zooms, since a note has no full screen. */
  resizable: true,
  /** The note opens the Fonts and Colors panels of its Font menu as windows of the desktop. */
  windows: true,
  /** Services > Make New Sticky Note makes a note of the selected text. */
  takesSharedText: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Stickies", "File", "Edit", "Font", "Color", "Window", "Help"],
  /** The notes the app opens with: each one's id, colour, text and frame. */
  notes: defaultStickies,
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = stickiesApp;

export type {
  StickiesDesktopNoteProps,
  StickiesNoteActions,
  StickiesNoteProps,
  StickiesProps,
} from "./stickies";
export { Stickies } from "./stickies";
export type { StickiesColor, StickiesNoteData } from "./stickies-data";
export type { StickiesPanel } from "./stickies-format";
