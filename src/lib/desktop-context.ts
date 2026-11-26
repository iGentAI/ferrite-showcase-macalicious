import { createContext } from "react";

/**
 * Lets the icons on a desktop share one selection, with nothing for the application to wire up.
 *
 * A `Desktop` provides which values are selected and a way to change that; a `DesktopIcon` (or
 * a `DesktopStack`) inside it reads its own state from here instead of keeping it. Outside a
 * desktop there is no value and an icon keeps its own state.
 */
export interface DesktopContextValue {
  /** The values of the selected icons. */
  selected: readonly string[];
  /**
   * Select one icon. With `extend` (Command or Shift held) the icon is added to the selection,
   * or taken out of it when it is in already; without, it becomes the only selected icon.
   */
  select: (value: string, extend: boolean) => void;
}

export const DesktopContext = createContext<DesktopContextValue | null>(null);
