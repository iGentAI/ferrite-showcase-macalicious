import { Terminal } from "./terminal";
import { DEFAULT_FRAME, MIN_FRAME } from "./terminal-frame";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is the
 * library's `Window`, and it takes that window's props with the window controls' and the drag
 * region's), open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar
 * while it is the front application. With `windows`, the desktop gives it `DesktopWindow`, through
 * which Shell > New Window opens further windows.
 */
export const terminalApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "terminal",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Terminal",
  /** The app as a window: tabs of a simulated shell that reads the person's drive. */
  component: Terminal,
  defaultSize: DEFAULT_FRAME,
  minSize: MIN_FRAME,
  resizable: true,
  windows: true,
  preferences: "own",
  opens: (file: { name: string }) => /\.(command|tool|terminal)$/i.test(file.name),
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Terminal", "Shell", "Edit", "View", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = terminalApp;

export type { TerminalProps } from "./terminal";
