import { createContext } from "react";

/**
 * True below a `Toolbar`. Toolbar items (button, segmented control, search field) read it to
 * decide whether to register with the toolbar's roving focus or to stand on their own, so the
 * same component works inside and outside a toolbar. It is a constant, so reading it
 * re-renders nothing.
 */
export const ToolbarContext = createContext(false);
