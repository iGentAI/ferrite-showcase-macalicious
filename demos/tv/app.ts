import { isMovie } from "../quicktime-player/quicktime-player-recents";
import { TvYouTube } from "./tv-youtube";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const tvApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "tv",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "TV",
  /**
   * The app as a window: TV playing YouTube videos (`TvYouTube`), with History, Up Next and Watch
   * Later. The catalogue window of the captures is `Tv`, which the documentation shows.
   */
  component: TvYouTube,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1294, height: 876 },
  /** The smallest frame at which the sections and the search field stay apart. */
  minSize: { width: 900, height: 420 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** What Finder's Open With opens here as a home video: QuickTime Player stays the default. */
  opens: isMovie,
  opensOnlyWhenAsked: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["TV", "File", "Edit", "View", "Controls", "Account", "Window", "Help"],
  /**
   * The window renders TV > Preferences… itself (`TvPreferences`, over the middle of the TV
   * window): a desktop opens it with `preferencesOpen` and hears of Command-comma and of its
   * closing in `onPreferencesOpenChange`. Served by the desktop's Ferrite application, TV keeps
   * the one setting it carries out, List Size, for the person on the server, and shows the others
   * dimmed with their reasons.
   */
  preferences: "own",
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = tvApp;

export type { TvProps } from "./tv";
export type { TvListSize, TvSection, TvSettings, TvTitle } from "./tv-data";
export { TvPreferences, type TvPreferencesProps } from "./tv-preferences";
export { TvYouTube, type TvYouTubeProps } from "./tv-youtube";
