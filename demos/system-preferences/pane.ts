import {
  type ComponentType,
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/** The window is 668 pt wide in every pane and on the Show All grid. */
export const WINDOW_WIDTH = 668;

/** Height of the window while it shows the grid of every pane. */
export const GRID_HEIGHT = 554;

/**
 * What a pane folder exports as `pane` from `panes/<id>/pane.tsx`. The folder name is the
 * pane's id and must be one of the ids in `catalogue.ts`, which holds the name and the caption
 * the grid shows. See `panes/README.md`.
 */
export interface PreferencePane {
  /** Height of the whole window, title bar included, while the pane is open, in points. */
  height: number;
  /** The pane's content. It is rendered in a box 668 pt wide and `height - 38` pt high. */
  component: ComponentType;
  /** Words the toolbar's search field finds the pane by, besides its name. */
  keywords?: readonly string[];
  /**
   * The window's title while the pane is open, when it is not the pane's name in the
   * catalogue: the Displays pane is titled after the display.
   */
  title?: string;
  /**
   * On the desktop served by the Ferrite application, what the pane shows in place of `component`
   * when `component` shows facts of the captured Mac: a page of `served-pages.tsx`, whose settings
   * nothing keeps. Its height is the whole window's, as `height` is.
   */
  served?: { component: ComponentType; height: number; title?: string };
}

/** Declares a pane. It returns its argument; it exists for the type check and for search. */
export function definePane(pane: PreferencePane): PreferencePane {
  return pane;
}

/** What the shell shares with the pane that is open. */
export interface PreferencesContextValue {
  /** Settings by key, kept for as long as the window is mounted. */
  values: Map<string, unknown>;
  /**
   * The element whose appearance, accent and highlight the General pane changes. Undefined
   * means the page: the `<html>` element.
   */
  themeTarget: HTMLElement | undefined;
  /** Open another pane by id, or the grid with `null`. */
  showPane: (id: string | null) => void;
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Settings whose values can change from outside the window (another System Preferences window
 * on the same page): `subscribe` hears the key of each such change.
 */
export interface ObservableSettings {
  subscribe: (listener: (key: string) => void) => () => void;
}

const observable = (values: Map<string, unknown> | undefined) =>
  values && typeof (values as Partial<ObservableSettings>).subscribe === "function"
    ? (values as Map<string, unknown> & ObservableSettings)
    : null;

/**
 * State for one setting of a pane, like `useState`, that survives leaving the pane and coming
 * back. Prefix the key with the pane's id: `usePreference("dock.size", 0.4)`. Outside the
 * System Preferences window (a pane rendered alone in a test) it is plain component state.
 */
export function usePreference<T>(key: string, initial: T): [T, (value: T) => void] {
  const values = use(PreferencesContext)?.values;
  const [value, setValue] = useState<T>(() =>
    values?.has(key) ? (values.get(key) as T) : initial,
  );
  const set = useCallback(
    (next: T) => {
      values?.set(key, next);
      setValue(next);
    },
    [values, key],
  );
  // A value put in from elsewhere shows at once in a control that is already mounted; a new
  // key or settings map shows what that one holds.
  const first = useRef({ values, key, initial });
  useEffect(() => {
    const seen = first.current;
    if (seen.values !== values || seen.key !== key) {
      first.current = { values, key, initial: seen.initial };
      setValue(values?.has(key) ? (values.get(key) as T) : seen.initial);
    }
    const settings = observable(values);
    if (!settings) return;
    return settings.subscribe((changed) => {
      if (changed === key && settings.has(key)) setValue(settings.get(key) as T);
    });
  }, [values, key]);
  return [value, set];
}

/** The shell's side of the pane that is open: the theme target and navigation. */
export function usePreferences(): Pick<PreferencesContextValue, "themeTarget" | "showPane"> {
  const context = use(PreferencesContext);
  return {
    themeTarget: context?.themeTarget,
    showPane: context?.showPane ?? (() => {}),
  };
}
