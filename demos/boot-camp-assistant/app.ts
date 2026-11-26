import { BootCampAssistant } from "./boot-camp-assistant";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's assistant window, a `Window`, and it takes that window's props together with
 * the window controls' and the drag region's callbacks, which are the props a managed window's
 * `render` supplies), open it at `defaultSize`, and show `menus` in the menu bar while it is
 * the front application.
 */
export const bootCampAssistantApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "boot-camp-assistant",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Boot Camp Assistant",
  /** The app as a window. */
  component: BootCampAssistant,
  /** The frame of the window, in points: the reference capture's. An assistant has one size. */
  defaultSize: { width: 783, height: 548 },
  /** The same: the window is not resized. */
  minSize: { width: 783, height: 548 },
  /** The window cannot be resized, and its green button is unavailable. */
  resizable: false,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Boot Camp Assistant", "File", "Edit", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = bootCampAssistantApp;

export type { BootCampAssistantProps } from "./boot-camp-assistant";
