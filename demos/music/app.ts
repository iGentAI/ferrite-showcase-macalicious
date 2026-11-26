import { DesktopMusic } from "./music-desktop";
import { isSongFile } from "./music-tags";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks), open it at `defaultSize`, keep it at least `minSize`, and
 * show `menus` in the menu bar while it is the front application.
 */
export const musicApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "music",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Music",
  /**
   * The app as a window. Served by the `macalicious-desktop` Ferrite application it plays the
   * person's own songs and openly licensed music from the Internet Archive and keeps the
   * library on the server; elsewhere the demo's invented library with a simulated transport.
   */
  component: DesktopMusic,
  /** Finder opens sound files here: double-click, Open With, or a drop on the Dock's tile. */
  opens: isSongFile,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1220, height: 720 },
  /** The smallest frame at which the playback bar keeps all of its controls. */
  minSize: { width: 860, height: 400 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Music", "File", "Edit", "Song", "View", "Controls", "Account", "Window", "Help"],
  /**
   * The window renders the Preferences window itself: a desktop opens it with
   * `preferencesOpen` and hears of Command-comma and of its closing in
   * `onPreferencesOpenChange`.
   */
  preferences: "own",
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = musicApp;

export type { MusicProps } from "./music";
export { MusicPreferences, type MusicPreferencesProps } from "./music-preferences";
