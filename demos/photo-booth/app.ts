import { DesktopPhotoBooth } from "./photo-booth-desktop";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const photoBoothApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "photo-booth",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Photo Booth",
  /**
   * The app as a window: the Effects browser and the camera view. Served by the
   * `macalicious-desktop` Ferrite application it shows the browser's camera and keeps every
   * picture on the server; elsewhere the demo's placeholder picture.
   */
  component: DesktopPhotoBooth,
  /** The frame the window opens at, in points: the reference captures'. */
  defaultSize: { width: 720, height: 562 },
  /** The same frame: smaller, the previews would be too small to tell apart. */
  minSize: { width: 720, height: 562 },
  /** It grows from there, and enters full screen with the camera filling it. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Photo Booth", "File", "Edit", "View", "Camera", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = photoBoothApp;

export type { PhotoBoothProps } from "./photo-booth";
