import { ChessLive } from "./chess-live";
import { isPgn } from "./chess-pgn";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const chessApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "chess",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Chess",
  /**
   * The app as a window: one game. Served by the desktop's Ferrite application, it plays the
   * game every browser on the desktop shares (`chess-live.tsx`); elsewhere it is `Chess`.
   */
  component: ChessLive,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 971, height: 702 },
  /** The smallest frame in which the squares stay large enough to tell the pieces apart. */
  minSize: { width: 420, height: 480 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Chess", "Game", "Edit", "Moves", "View", "Window", "Help"],
  /** The window opens a further one, the Game Log: a desktop gives it `DesktopWindow`. */
  windows: true,
  /** The window renders its Preferences itself (`ChessPreferences`, a window of its own). */
  preferences: "own",
  /** What Finder opens here: a saved game (`takeOpenFileRequests`). */
  opens: (file: { name: string }) => isPgn(file.name),
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = chessApp;

export type { ChessProps } from "./chess";
