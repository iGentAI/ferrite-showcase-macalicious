import { MessagesLive, MessagesPreferencesLive } from "./messages-live";
import { PREFERENCES_HEIGHT, PREFERENCES_WIDTH } from "./messages-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const messagesApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "messages",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Messages",
  /**
   * The app as a window. Left to itself it opens its Preferences beside itself, on
   * Command-comma; a desktop that hosts `preferences` as a window of its own takes that key
   * before the window sees it, and gives the window the `settings` the Preferences report.
   * Served by the desktop's Ferrite application, it also shows the conversation every browser
   * on the desktop shares (`messages-live.tsx`); elsewhere it is `Messages`.
   */
  component: MessagesLive,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 730, height: 520 },
  /** The smallest frame at which the list and a line of the transcript keep their room. */
  minSize: { width: 560, height: 320 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Messages", "File", "Edit", "View", "Buddies", "Window", "Help"],
  /** Share > Messages: files shared from Finder go to the conversation shown, or a new message. */
  takesSharedFiles: true,
  /**
   * The window that Messages > Preferences opens, as a second window of a desktop: its root
   * is the library's `PreferencesWindow`, which sizes itself to the selected pane and is not
   * resizable. `defaultSize` is its frame in points when it opens, on its first pane; the
   * width stays and the height follows the pane. The two windows share the settings
   * (`sharesSettings`): the Preferences report them through `onSettingsChange`, and both
   * windows are given what was reported as `settings`, so the transcript follows the Text
   * size slider. Served by the desktop's Ferrite application, which has no help book for
   * Messages, its Help buttons are dimmed and say why (`messages-live.tsx`); elsewhere it is
   * `MessagesPreferences`.
   */
  preferences: {
    component: MessagesPreferencesLive,
    defaultSize: { width: PREFERENCES_WIDTH, height: PREFERENCES_HEIGHT },
    sharesSettings: true,
  },
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = messagesApp;

export type { MessagesProps } from "./messages";
export type { MessagesConversation, MessagesMessage, MessagesSettings } from "./messages-data";
export { MessagesPreferences, type MessagesPreferencesProps } from "./messages-preferences";
