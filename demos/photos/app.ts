import { DesktopPhotos } from "./photos-desktop";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const photosApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "photos",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Photos",
  /**
   * The app as a window. Served by the `macalicious-desktop` Ferrite application it is the
   * person's own photo library; elsewhere the demo's placeholder library.
   */
  component: DesktopPhotos,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1200, height: 720 },
  /** The smallest frame that keeps the header's line whole and three pictures in a row. */
  minSize: { width: 760, height: 360 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Photos", "File", "Edit", "Image", "View", "Window", "Help"],
  /** A Share menu's Add to Photos: the pictures and movies are imported. */
  takesSharedFiles: true,
  /** Open With and a drop on the Dock's tile import these; a double-click leaves them to their app. */
  opens: (file: { name: string; type?: string }) =>
    /^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime|webm))$/.test(file.type ?? "") ||
    /\.(jpe?g|png|gif|webp|mp4|m4v|mov|webm)$/i.test(file.name),
  opensOnlyWhenAsked: true,
  /**
   * The window renders its Preferences itself: a desktop opens them with `preferencesOpen` and
   * hears of Command-comma and of their closing in `onPreferencesOpenChange`.
   */
  preferences: "own",
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = photosApp;

export type { PhotosProps } from "./photos";
export type { PhotosService } from "./photos-artwork";
export type {
  Photo,
  PhotoKind,
  PhotoShape,
  PhotosFilter,
  PhotosSource,
  PhotosSourceId,
} from "./photos-data";
