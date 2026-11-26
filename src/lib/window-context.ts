import { createContext } from "react";

/**
 * Lets a title bar name the window it sits in, with nothing for the application to wire up.
 *
 * A window provides the id its title should carry and a way for the title to say that it
 * exists; the window then points `aria-labelledby` at it. The value never changes after the
 * window mounts, so reading it re-renders nothing. It carries no window state: the key, main
 * or inactive state is the `data-window-state` attribute (CONTRIBUTING, "Window state").
 */
export interface WindowContextValue {
  /** The id the window's title element should carry. */
  titleId: string;
  /** Called by a title when it mounts; the returned function is called when it unmounts. */
  registerTitle: () => () => void;
}

export const WindowContext = createContext<WindowContextValue | null>(null);
