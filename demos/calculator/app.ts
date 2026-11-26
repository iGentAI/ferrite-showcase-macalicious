import { Calculator } from "./calculator";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's props, which are the props a managed window's `render` supplies), open
 * it at `defaultSize`, and show `menus` in the menu bar while it is the front application.
 */
export const calculatorApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "calculator",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Calculator",
  /** The app as a window. */
  component: Calculator,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 232, height: 321 },
  /** Each layout has one size, which the window sets itself: the basic one is the smallest. */
  minSize: { width: 232, height: 321 },
  /** The window cannot be resized; a window manager disables its zoom button. */
  resizable: false,
  /**
   * The window opens a further one, the Paper Tape: a desktop gives it `DesktopWindow`. It does
   * so only on the desktop of the Ferrite application, which keeps the tape.
   */
  windows: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Calculator", "File", "Edit", "View", "Convert", "Speech", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = calculatorApp;

export type { CalculatorProps } from "./calculator";
