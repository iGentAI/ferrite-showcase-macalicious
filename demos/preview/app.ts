import { PreviewApp } from "./preview-app";
import { PreviewPreferences } from "./preview-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`; it takes the props a managed window's `render` form supplies and
 * hands the window controls' and the title bar's to those parts), open it at `defaultSize`,
 * keep it at least `minSize`, and show `menus` in the menu bar while it is the front
 * application.
 */
export const previewApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "preview",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Preview",
  /**
   * The app as a window: on the desktop the Ferrite application serves, the person's own pictures
   * and PDFs from their drive (`PreviewApp`); elsewhere the booklet of the reference captures,
   * with its thumbnails (`Preview`).
   */
  component: PreviewApp,
  /** The frame the window opens at, in points: the Aqua Preview-Search capture's. */
  defaultSize: { width: 1147, height: 793 },
  /**
   * The smallest frame at which the toolbar keeps all of its items: their fixed widths, the
   * gaps between them and the bar's padding add up to 585 pt.
   */
  minSize: { width: 600, height: 360 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Preview", "File", "Edit", "View", "Go", "Tools", "Window", "Help"],
  /** What Preview > Preferences… opens. */
  preferences: { component: PreviewPreferences, defaultSize: { width: 520, height: 260 } },
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = previewApp;

export type { PreviewProps, PreviewShareService, PreviewSidebar } from "./preview";
export { PreviewApp, type PreviewAppProps } from "./preview-app";
export type {
  PreviewDocument,
  PreviewImageDocument,
  PreviewPage,
  PreviewPdfDocument,
  PreviewSearchResult,
  PreviewSort,
} from "./preview-data";
export { desktopPicture, islandFerry, searchDocument } from "./preview-data";
export type { PreviewDrive } from "./preview-drive";
