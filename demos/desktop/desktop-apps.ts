import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import type { PreferencesWindowProps } from "macalicious/preferences-window";
import type { ComponentType, ReactNode } from "react";

/**
 * The props of `DesktopWindow`, the component an application whose descriptor says `windows`
 * is given to open further windows on the desktop: a compose window, an inspector, a panel.
 * The application renders one where it would render the window itself, for as long as the
 * window is open, and keeps what the window shows; the desktop places, moves, orders and
 * focuses it as a window of the same application.
 */
export interface DesktopSecondaryWindowProps {
  /**
   * Names the window among the application's own: its id on the desktop is `<app>:<id>`.
   * `"preferences"` is taken by the application's hosted Preferences and is refused.
   */
  id: string;
  /** The window's name in the Window menu and on its Dock tile while it is minimized. */
  title: string;
  /** The frame the window opens at, in points. */
  defaultSize: { width: number; height: number };
  /** The smallest frame the window can be resized to. */
  minSize?: { width: number; height: number };
  /** Whether the window can be resized; `true` when left out, and never with `fitsContent`. */
  resizable?: boolean;
  /** What the green button of a resizable window does; `"full-screen"` when left out. */
  zoomButton?: "full-screen" | "zoom";
  /**
   * A utility panel: it floats above the ordinary windows, and while it is key the front
   * ordinary window stays main. `false` when left out.
   */
  panel?: boolean;
  /**
   * Whether the window is as tall as what it shows, as an Info window is whose sections open
   * and close: `render` is then given `style` with an automatic height, and the frame follows
   * the height the window has. Such a window cannot be resized. `false` when left out.
   */
  fitsContent?: boolean;
  /**
   * For a window whose root has no title bar that takes the drag region's callbacks (an
   * inspector panel, a Quick Look panel): a selector for the part of the window that moves it.
   * `render` is then given an `onPointerDown` for the window's root, which starts the move
   * from a press on that part and not on a control in it.
   */
  dragRegion?: string;
  /**
   * Whether this is the Preferences window of an application whose `preferences` is `"own"`:
   * the Preferences command brings it forward while it is open. `false` when left out.
   */
  isPreferences?: boolean;
  /**
   * Called when the window is asked to close from the desktop (its close button, the Window
   * menu, the keyboard): the application closes it by no longer rendering it, and may keep it
   * open instead, as Mail does with a message being sent.
   */
  onClose: () => void;
  /**
   * The window: a component whose root is a window of the library, given the props a managed
   * window's `render` form supplies, as the application's main `component` is.
   */
  render: (props: ManagedWindowRenderProps) => ReactNode;
}

/** The props the desktop gives an application's window. */
export interface DesktopWindowProps extends ManagedWindowRenderProps {
  /**
   * Given only to an application whose descriptor says `windows`: renders a further window of
   * the application as a window of the desktop.
   */
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
  /**
   * Given only to an application that `sizesItself`: called with the frame its window wants,
   * which the desktop then gives it.
   */
  onFrameSizeChange?: (size: { width: number; height: number }) => void;
  /**
   * Given only to an application whose `preferences` is `"own"`: whether its Preferences
   * window is open. The application renders the window itself.
   */
  preferencesOpen?: boolean;
  /**
   * Given only to an application whose `preferences` is `"own"`: called when the application
   * opens its Preferences window (its own Command-comma) or closes it.
   */
  onPreferencesOpenChange?: (open: boolean) => void;
  /**
   * Given only to an application whose `preferences` window `sharesSettings`: what that
   * window last reported in `onSettingsChange`, and `undefined` before it has. The type is
   * the application's own.
   */
  // biome-ignore lint/suspicious/noExplicitAny: each application has its own settings type.
  settings?: any;
  /**
   * Given only to an application that `managesApplications`: the applications running on the
   * desktop (each with a window open) other than itself, by name, and Finder last, which
   * relaunches rather than quits.
   */
  runningApplications?: readonly DesktopRunningApplication[];
  /**
   * Given only to an application that `managesApplications`: quits the application `id`,
   * closing every window it has. Finder's windows close and Finder goes on running.
   */
  onQuitApplication?: (id: string) => void;
}

/** An application running on the desktop, as `runningApplications` lists it. */
export interface DesktopRunningApplication {
  id: string;
  name: string;
  /** Finder: it starts again when it is quit, and stays running. */
  relaunches?: boolean;
}

/**
 * The props the desktop gives a Preferences window that it hosts: those of the library's
 * `PreferencesWindow`, which is the component's root, without the toolbar and the panes,
 * which are the component's own.
 */
export type DesktopPreferencesProps = Omit<PreferencesWindowProps, "toolbar" | "children">;

/**
 * The props of a hosted Preferences window whose descriptor says `sharesSettings`: both are
 * always given, so a component may declare them required.
 */
export interface DesktopSharedPreferencesProps extends DesktopPreferencesProps {
  /**
   * The application's settings as this window last reported them, and `undefined` before it
   * has: the window then shows its own default. The type is the application's own.
   */
  // biome-ignore lint/suspicious/noExplicitAny: each application has its own settings type.
  settings: any;
  /** Called with all settings when a control changes one. */
  // biome-ignore lint/suspicious/noExplicitAny: each application has its own settings type.
  onSettingsChange: (settings: any) => void;
}

interface DesktopPreferencesWindow {
  /**
   * The frame the window opens at, in points. The width stays; the height follows the pane
   * that is shown, as in Catalina.
   */
  defaultSize: { width: number; height: number };
  /**
   * The window's name in the Window menu and on its Dock tile while it is minimized. The
   * application's name and "Preferences" when left out.
   */
  title?: string;
}

/**
 * An application's Preferences window, as a second window of the desktop. `component` has
 * the library's `PreferencesWindow` as its root and hands that window every prop it is given:
 * `state`, `width`, `style`, `onClose`, `controls` and the rest.
 *
 * With `sharesSettings: true` the application's two windows share its settings: `component`
 * is then given `settings` and `onSettingsChange` (and may require them), and the
 * application's main window is given `settings`, which is what `onSettingsChange` was last
 * called with, and `undefined` before that, for each window's own default.
 */
export type DesktopPreferences =
  | (DesktopPreferencesWindow & {
      component: ComponentType<DesktopPreferencesProps>;
      sharesSettings?: false;
    })
  | (DesktopPreferencesWindow & {
      component: ComponentType<DesktopSharedPreferencesProps>;
      sharesSettings: true;
    });

/**
 * What the desktop reads from a demo: the descriptor every `demos/<app>/app.ts` exports as
 * `app`. `component` has a window of the library as its root and takes the props a managed
 * window's `render` form supplies.
 */
export interface DesktopApp {
  /** Identifies the app among the demos: the folder's name. */
  id: string;
  /** The application's name: the title of its application menu and its Dock label. */
  name: string;
  /** The app as a window. */
  component: ComponentType<DesktopWindowProps>;
  /** The frame the window opens at, in points. */
  defaultSize: { width: number; height: number };
  /** The smallest frame the window can be resized to. */
  minSize?: { width: number; height: number };
  /** Whether the window can be resized; `true` when left out. */
  resizable?: boolean;
  /**
   * A window of the system's rather than of an application: it floats above the others, and
   * while it is key the menu bar stays the application of the window behind it. `false` when left out.
   */
  systemPanel?: boolean;
  /**
   * An application whose window floats above the others at a panel's level, as Help Viewer's does, and which still has
   * the menu bar while its window is key. `false` when left out.
   */
  floats?: boolean;
  /**
   * What the green button of a resizable window does: enter full screen, or `"zoom"` for a
   * window that has no full screen. `"full-screen"` when left out.
   */
  zoomButton?: "full-screen" | "zoom";
  /**
   * Whether the window chooses its own frame, as System Preferences does for each pane:
   * `component` then takes `onFrameSizeChange` and the desktop resizes the window to what it
   * is called with. `false` when left out.
   */
  sizesItself?: boolean;
  /**
   * Whether the application opens further windows on the desktop (a compose window, an Info
   * window, a panel): `component` is then given `DesktopWindow`, a component that renders one
   * as a window of the desktop. `false` when left out, and the application's further windows
   * are then its own to place.
   */
  windows?: boolean;
  /**
   * The application's Preferences window, which its application menu's Preferences… command
   * and Command-comma open. Either a second window that the desktop hosts beside the main one
   * (the desktop takes Command-comma before the application's windows see it), or `"own"` for
   * an application that renders its Preferences window itself (`component` is then given
   * `preferencesOpen` and `onPreferencesOpenChange`). Left out, the command is dimmed.
   */
  preferences?: DesktopPreferences | "own";
  /**
   * Which drive files the application opens, once its window takes them from
   * `takeOpenFileRequests` and `onOpenFileRequest` (`demos/finder/finder-open.ts`): Finder then
   * opens them there, lists it under Open With, and its Dock tile takes them.
   */
  opens?: (file: { name: string; type?: string }) => boolean;
  /**
   * `opens` applies only when the person names the application (Open With, a drop on its Dock
   * tile): a double-click never picks it. For an application that takes a file in, as Photos imports.
   */
  opensOnlyWhenAsked?: boolean;
  /**
   * Whether the application takes files shared with it, once its window takes them from
   * `takeSharedFiles` and `onSharedFiles` (`desktop-share-link.tsx`): the Share menus of Finder
   * and Quick Look then offer it.
   */
  takesSharedFiles?: boolean;
  /**
   * Whether the application takes text from a service, once its window takes it from
   * `takeSharedText` and `onSharedText` (`desktop-services.tsx`): the Services submenu then lists
   * it while text is selected.
   */
  takesSharedText?: boolean;
  /**
   * What File calls the command that opens another window of the application, whose state is its
   * own ("New Window"; Finder's is "New Finder Window"): the row, and Command-N while the
   * application is in front. Left out, the application has one main window.
   */
  newWindowTitle?: string;
  /**
   * Whether the application acts on the desktop's other applications, as Force Quit does:
   * `component` is then given `runningApplications` and `onQuitApplication`. `false` when left
   * out.
   */
  managesApplications?: boolean;
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: readonly string[];
  /**
   * Called once when the desktop starts, whether or not the application's window opens: for
   * an application whose setting affects the whole desktop, as the appearance chosen in
   * System Preferences does. It may return a cleanup, called when the desktop goes.
   */
  onDesktopStart?: () => (() => void) | undefined;
}

const isSize = (value: unknown): value is { width: number; height: number } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { width?: unknown }).width === "number" &&
  typeof (value as { height?: unknown }).height === "number";

const isComponent = (value: unknown) =>
  typeof value === "function" || (typeof value === "object" && value !== null);

/** Whether a descriptor's `preferences` is one the desktop can open: left out counts. */
const isPreferences = (value: unknown) =>
  value === undefined ||
  value === "own" ||
  (typeof value === "object" &&
    value !== null &&
    isComponent((value as { component?: unknown }).component) &&
    isSize((value as { defaultSize?: unknown }).defaultSize));

/** Whether a module's `app` export is a descriptor the desktop can host. */
export function isDesktopApp(value: unknown): value is DesktopApp {
  if (typeof value !== "object" || value === null) return false;
  const app = value as Partial<Record<keyof DesktopApp, unknown>>;
  return (
    typeof app.id === "string" &&
    typeof app.name === "string" &&
    isComponent(app.component) &&
    isSize(app.defaultSize) &&
    isPreferences(app.preferences) &&
    Array.isArray(app.menus) &&
    app.menus.length > 0
  );
}

/**
 * The id of a further window of an application on the desktop: its Preferences, when the
 * desktop hosts them, and every window it opens through `DesktopWindow`.
 */
export const secondaryWindowId = (app: string, id: string) => `${app}:${id}`;

/** The id of the window that holds an application's Preferences, when the desktop hosts it. */
export const preferencesWindowId = (app: string) => secondaryWindowId(app, "preferences");

/**
 * The order of the Dock in the Desktop screenshots, by demo folder. A demo that is not named
 * here follows these, in the order of its name.
 */
const DOCK_ORDER = [
  "finder",
  "safari",
  "mail",
  "facetime",
  "messages",
  "maps",
  "photos",
  "contacts",
  "calendar",
  "reminders",
  "notes",
  "music",
  "podcasts",
  "tv",
  "news",
  "app-store",
  "system-preferences",
];

const rank = (id: string) => {
  const index = DOCK_ORDER.indexOf(id);
  return index < 0 ? DOCK_ORDER.length : index;
};

/** Descriptors in Dock order. */
export const inDockOrder = (apps: readonly DesktopApp[]): DesktopApp[] =>
  [...apps].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, "en"));

/**
 * What two demos say about their windows in prose only, in the words of the descriptor: a
 * Stickies note zooms, since it has no full screen, and System Preferences reports the frame
 * of every pane. A descriptor that names these itself is taken at its word.
 */
const HOSTING: Readonly<Record<string, Pick<DesktopApp, "zoomButton" | "sizesItself">>> = {
  stickies: { zoomButton: "zoom" },
  "system-preferences": { sizesItself: true },
};

// Every demo that exports a descriptor is hosted: a demo that lands in demos/ later appears on
// the desktop without a change here. The desktop's own folder has no app.ts.
const modules = import.meta.glob<{ app?: unknown }>("../*/app.ts", { eager: true });

/** The demo applications found in `demos/`, in Dock order. */
export const discoveredApps: readonly DesktopApp[] = inDockOrder(
  Object.values(modules)
    .map((module) => module.app)
    .filter(isDesktopApp)
    .map((app) => ({ ...HOSTING[app.id], ...app })),
);
