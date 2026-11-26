import { MailLive } from "./mail-live";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`; it takes the props a managed window's `render` form supplies and
 * hands the window controls' and the title bar's to those parts), open it at `defaultSize`,
 * keep it at least `minSize`, and show `menus` in the menu bar while it is the front
 * application.
 */
export const mailApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "mail",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Mail",
  /**
   * The app as a window: the viewer, which opens its other windows beside itself. Served by the
   * desktop's Ferrite application it is real mail between the desktop's accounts
   * (`mail-live.tsx`); elsewhere it is `Mail`.
   */
  component: MailLive,
  /** The frame the viewer opens at, in points: the reference capture's. */
  defaultSize: { width: 1061, height: 711 },
  /**
   * The smallest frame at which the toolbar keeps all of its items: their fixed widths, the
   * gaps between them and the bar's padding add up to 966 pt.
   */
  minSize: { width: 980, height: 360 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Mail", "File", "Edit", "View", "Mailbox", "Message", "Format", "Window", "Help"],
  /**
   * The viewer renders the Preferences window itself: a desktop opens it with
   * `preferencesOpen` and hears of Command-comma and of its closing in
   * `onPreferencesOpenChange`.
   */
  preferences: "own",
  /**
   * The viewer opens New Message windows: a desktop gives it `DesktopWindow`, and each is then
   * a window of that desktop.
   */
  windows: true,
  /** Finder's Share menu lists Mail: the files go into a New Message. */
  takesSharedFiles: true,
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = mailApp;

export type { MailProps } from "./mail";
export { MailCompose, type MailComposeProps } from "./mail-compose";
export type { MailboxId, MailDraft, MailMessage, MailSettings } from "./mail-data";
export { MailPreferences, type MailPreferencesProps } from "./mail-preferences";
