import { FaceTimeLive } from "./facetime-live";
import { FaceTimePreferences } from "./facetime-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`; it takes the props a managed window's `render` form supplies and
 * hands the window controls' to that part and the drag region's to the top of its sidebar),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const facetimeApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "facetime",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "FaceTime",
  /**
   * The app as a window. Served by the desktop's Ferrite application, it places and answers
   * real calls between the desktop's accounts (`facetime-live.tsx`); elsewhere it is `FaceTime`.
   */
  component: FaceTimeLive,
  /** The frame the window opens at, in points: the reference captures'. */
  defaultSize: { width: 652, height: 585 },
  /** The smallest frame that keeps the 262 pt sidebar and the whole call panel beside it. */
  minSize: { width: 560, height: 320 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["FaceTime", "File", "Edit", "Video", "Window", "Help"],
  /** A window of the desktop: Settings and the Blocked list, kept with the person's values. */
  preferences: { component: FaceTimePreferences, defaultSize: { width: 480, height: 300 } },
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = facetimeApp;

export type { FaceTimeProps } from "./facetime";
export type {
  FaceTimeCall,
  FaceTimeCallKind,
  FaceTimeCallStatus,
  FaceTimeFilter,
  FaceTimeOutgoingCall,
} from "./facetime-data";
