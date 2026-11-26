import { QuickTimePlayerApp } from "./quicktime-player-app";
import { opensInQuickTime } from "./quicktime-player-recents";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const quicktimePlayerApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "quicktime-player",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "QuickTime Player",
  /**
   * The app as a window: the Open panel, then the movie chosen, played for real
   * (`QuickTimePlayerApp`). The movie window of the captures is `QuickTimePlayer`.
   */
  component: QuickTimePlayerApp,
  /** The frame the window opens at, in points: the light reference capture's, 16:9. */
  defaultSize: { width: 1470, height: 827 },
  /** The smallest frame that holds the 440 pt controller with 20 pt beside it, at 16:9. */
  minSize: { width: 480, height: 270 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** The window asks for the Open panel's frame, then a movie's (`onFrameSizeChange`). */
  sizesItself: true,
  /** What Finder opens here: movies and sound (`takeOpenFileRequests`). */
  opens: opensInQuickTime,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["QuickTime Player", "File", "Edit", "View", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = quicktimePlayerApp;

export type { QuickTimePlayerProps } from "./quicktime-player";
export { QuickTimePlayerApp, type QuickTimePlayerAppProps } from "./quicktime-player-app";
export type { QuickTimeDrive, QuickTimeMovieFile } from "./quicktime-player-drive";
