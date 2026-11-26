import { DesktopPodcasts } from "./podcasts-desktop";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`; it takes the props a managed window's `render` form supplies and
 * hands the window controls' to that part and the drag region's to the playback bar and the
 * sidebar's header), open it at `defaultSize`, keep it at least `minSize`, and show `menus` in
 * the menu bar while it is the front application.
 */
export const podcastsApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "podcasts",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Podcasts",
  /**
   * The app as a window: the player, which opens its Preferences beside itself. Served by the
   * `macalicious-desktop` Ferrite application it finds real shows in Apple's directory, reads
   * their feeds and plays their episodes from each publisher, for the person signed in;
   * elsewhere it is the demo, with invented shows and a simulated transport.
   */
  component: DesktopPodcasts,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1137, height: 764 },
  /**
   * The smallest frame at which the 260 pt sidebar, the playback bar's three columns and one
   * 252 pt episode card with its margins still fit.
   */
  minSize: { width: 900, height: 420 },
  /** What Finder opens here: a list of shows (`takeOpenFileRequests`). */
  opens: (file: { name: string }) => /\.opml$/i.test(file.name),
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Podcasts", "File", "Edit", "View", "Controls", "Account", "Window", "Help"],
  /**
   * The player renders the Preferences window itself: a desktop opens it with
   * `preferencesOpen` and hears of Command-comma and of its closing in
   * `onPreferencesOpenChange`.
   */
  preferences: "own",
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = podcastsApp;

export type { PodcastsProps } from "./podcasts";
export type {
  PodcastsEpisode,
  PodcastsSection,
  PodcastsSettings,
  PodcastsShow,
} from "./podcasts-data";
export { PodcastsPreferences, type PodcastsPreferencesProps } from "./podcasts-preferences";
