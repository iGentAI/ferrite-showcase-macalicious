"use client";

import { Input as BaseInput } from "@base-ui/react/input";
import {
  Children,
  type ComponentProps,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { cn } from "../../lib/cn";
import { useControlled } from "../../lib/use-controlled";
import "./spotlight.tokens.css";
import "./spotlight.css";

// Why not Base UI's Combobox or Autocomplete (1.8): their highlighted item is output only
// (onItemHighlighted; the actions are `unmount` alone), so neither the application nor a click
// can select a result, which the top hit, the preview and Command-arrow need; and pressing an
// item writes it into the field. The field is Base UI's Input and the list follows the
// WAI-ARIA combobox pattern with a listbox popup.
interface SpotlightContextValue {
  id: string;
  selected: string | null;
  select?: (value: string) => void;
  open?: (value: string, details: { reveal: boolean }) => void;
  // Told by a result that comes, goes or changes, so that the window looks at its selection.
  gone?: () => void;
}

const SpotlightContext = createContext<SpotlightContextValue>({ id: "", selected: null });

// The element id of a result: any string gives one, and two values never the same.
const resultId = (base: string, value: string) =>
  `${base}-${value.replace(/[^a-z0-9]/gi, (c) => `_${c.charCodeAt(0).toString(36)}_`)}`;

const groupOf = (option?: HTMLElement) => option?.closest('[role="group"]');

export interface SpotlightProps extends Omit<ComponentProps<"div">, "defaultValue"> {
  /** The text of the search field, controlled. */
  value?: string;
  /**
   * The text of the search field at first, when the window keeps its own.
   * @default ""
   */
  defaultValue?: string;
  /** Called with the new text when the user types, or clears the field with Escape. */
  onValueChange?: (value: string) => void;
  /** The `value` of the selected result, controlled; `null` selects none. */
  selectedValue?: string | null;
  /**
   * The result selected at first, when the window keeps its own selection: normally the top
   * hit.
   * @default null
   */
  defaultSelectedValue?: string | null;
  /** Called with a result's `value` when the selection moves to it. */
  onSelectedValueChange?: (value: string | null) => void;
  /**
   * Called when a result is opened: Return, or a double click. `reveal` is true for
   * Command-Return, which in Spotlight shows the item in the Finder instead of opening it.
   */
  onOpenResult?: (value: string, details: { reveal: boolean }) => void;
  /** Called by Escape in an empty field. (Escape in a field with text clears it.) */
  onClose?: () => void;
  /**
   * Text of the empty field; it is also the field's accessible name.
   * @default "Spotlight Search"
   */
  placeholder?: string;
  /**
   * Completion shown after the typed text, behind a dash: the name of the top hit. It is
   * decorative; the top hit is announced as the selected result.
   */
  completion?: ReactNode;
  /** The top hit's icon, in a 28.5 pt box at the trailing end of the field. Decorative. */
  topHit?: ReactNode;
  /** Content of the preview pane, for the selected result. */
  preview?: ReactNode;
  /**
   * A line under the results and the preview, for what the search left out (a limit the
   * application wants the person to know of). Shown only while there are results; a `note`.
   */
  note?: ReactNode;
  /**
   * Accessible name of the list of results.
   * @default "Results"
   */
  resultsLabel?: string;
  /**
   * Accessible name of the preview pane.
   * @default "Preview"
   */
  previewLabel?: string;
  /** Ref to the `<input>`, to focus it when the window opens. */
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * The Spotlight search window: a large field on a blurred panel which, given results as
 * children (`SpotlightGroup`s of `SpotlightResult`s), grows into a list beside a preview. The
 * field is a combobox on Base UI's Input and keeps the focus; searching is the application's.
 */
export function Spotlight({
  value,
  defaultValue = "",
  onValueChange,
  selectedValue,
  defaultSelectedValue = null,
  onSelectedValueChange,
  onOpenResult,
  onClose,
  placeholder = "Spotlight Search",
  completion,
  topHit,
  preview,
  note,
  resultsLabel = "Results",
  previewLabel = "Preview",
  inputRef,
  className,
  children,
  ...props
}: SpotlightProps) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useControlled(value, defaultValue, onValueChange);
  const [selected, setSelected] = useControlled(
    selectedValue,
    defaultSelectedValue,
    onSelectedValueChange,
  );
  const expanded = Children.toArray(children).length > 0;

  // The results re-render when the selection moves, and not while the text is typed. A result
  // selected with the pointer takes the keyboard to the field, wherever the focus was.
  const [, gone] = useReducer((count: number) => count + 1, 0);
  const context = useMemo(
    () => ({
      id,
      selected,
      select(next: string) {
        setSelected(next);
        (queryRef.current?.firstElementChild as HTMLElement | null)?.focus();
      },
      open: onOpenResult,
      gone,
    }),
    [id, selected, setSelected, onOpenResult],
  );

  const options = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
  const current = () => options().find((option) => option.dataset.value === selected);

  // The results are the application's and can go while one of them is selected: the field
  // names only a result that is there, and a selection whose result is gone is dropped, once
  // for a controlled value that stays. This runs after every render of the window, and a
  // result that comes or goes by itself asks for one.
  const dropped = useRef<string | null>(null);
  useLayoutEffect(() => {
    const option = selected === null ? undefined : current();
    const input = queryRef.current?.firstElementChild;
    if (option) input?.setAttribute("aria-activedescendant", option.id);
    else input?.removeAttribute("aria-activedescendant");
    if (!option && selected !== dropped.current && selected !== null) setSelected(null);
    dropped.current = option ? null : selected;
  });

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // A key pressed while an input method composes is the input method's.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const all = options();
      if (all.length === 0) return;
      event.preventDefault();
      const down = event.key === "ArrowDown";
      const last = all.length - 1;
      const at = all.findIndex((option) => option.dataset.value === selected);
      let to = at < 0 ? (down ? 0 : last) : at + (down ? 1 : -1);
      if (event.metaKey && at >= 0) {
        // With Command: the first result of the next category, or of the previous one.
        const group = (index: number) => groupOf(all[index]);
        to = at;
        if (down) {
          while (to < last && group(to) === group(at)) to++;
          if (group(to) === group(at)) to = at;
        } else {
          while (to > 0 && group(to - 1) === group(at)) to--;
          to--;
          while (to > 0 && group(to - 1) === group(to)) to--;
        }
      }
      const next = all[Math.min(Math.max(to, 0), last)];
      if (!next) return;
      setSelected(next.dataset.value ?? null);
      next.scrollIntoView?.({ block: "nearest" });
    } else if (event.key === "Enter") {
      if (selected === null || !current()) return;
      event.preventDefault();
      onOpenResult?.(selected, { reveal: event.metaKey });
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (query) setQuery("");
      else onClose?.();
    }
  };

  return (
    <div
      data-expanded={expanded ? "" : undefined}
      className={cn("mac-spotlight", className)}
      {...props}
    >
      <div className="mac-spotlight-field">
        <svg className="mac-spotlight-glyph" viewBox="0 0 21.5 21.5" aria-hidden="true">
          <circle cx="7.9" cy="7.9" r="7.15" />
          <path d="M13.1 13.1 20.6 20.6" />
        </svg>
        <div ref={queryRef} className="mac-spotlight-query">
          <BaseInput
            ref={inputRef}
            role="combobox"
            aria-label={placeholder}
            aria-expanded={expanded}
            aria-controls={expanded ? `${id}-list` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={placeholder}
            className="mac-spotlight-input"
            value={query}
            onValueChange={(next) => setQuery(next)}
            onKeyDown={onKeyDown}
          />
          {completion != null && query !== "" && (
            <span className="mac-spotlight-ghost" aria-hidden="true">
              <span className="mac-spotlight-ghost-query">{query}</span>
              <span className="mac-spotlight-completion">— {completion}</span>
            </span>
          )}
        </div>
        {topHit != null && (
          <span className="mac-spotlight-top-hit" aria-hidden="true">
            {topHit}
          </span>
        )}
      </div>
      {expanded && (
        <div className="mac-spotlight-body">
          <SpotlightContext.Provider value={context}>
            <div
              ref={listRef}
              role="listbox"
              id={`${id}-list`}
              aria-label={resultsLabel}
              className="mac-spotlight-results"
            >
              {children}
            </div>
          </SpotlightContext.Provider>
          {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and its own layout */}
          <div role="group" aria-label={previewLabel} className="mac-spotlight-preview">
            {preview}
          </div>
        </div>
      )}
      {expanded && note != null && (
        <p role="note" className="mac-spotlight-note">
          {note}
        </p>
      )}
    </div>
  );
}

export interface SpotlightGroupProps extends ComponentProps<"div"> {
  /** Name of the category, shown in upper case in the 16 pt band above its results. */
  label: ReactNode;
}

/** One category of results: a header band, then its `SpotlightResult`s. A `group` named by its label. */
export function SpotlightGroup({ label, className, children, ...props }: SpotlightGroupProps) {
  const labelId = useId();
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of options inside a listbox
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn("mac-spotlight-group", className)}
      {...props}
    >
      <div id={labelId} role="presentation" className="mac-spotlight-group-label">
        {label}
      </div>
      {children}
    </div>
  );
}

export interface SpotlightResultProps extends Omit<ComponentProps<"div">, "id"> {
  /** What identifies the result: the value the selection holds. Unique within the window. */
  value: string;
  /** The result's icon, in a 16 pt box before the title. Decorative. */
  icon?: ReactNode;
}

/** One result, a 26 pt row with an icon and a title: a click selects it, a double click opens it. */
export function SpotlightResult({
  value,
  icon,
  className,
  children,
  onMouseDown,
  onClick,
  ...props
}: SpotlightResultProps) {
  const { id, selected, select, open, gone } = useContext(SpotlightContext);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a result whose value changes is another result
  useLayoutEffect(() => {
    gone?.();
    return gone;
  }, [gone, value]);
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the field keeps the focus and names the selected result with aria-activedescendant
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keys are handled in the field, which keeps the focus
    <div
      role="option"
      aria-selected={selected === value}
      data-value={value}
      className={cn("mac-spotlight-result", className)}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        // The press must not take the keyboard focus out of the field.
        event.preventDefault();
      }}
      onClick={(event) => {
        onClick?.(event);
        select?.(value);
        // The second click of a double click.
        if (event.detail === 2) open?.(value, { reveal: false });
      }}
      {...props}
      // The field refers to the result by this id, so it is the window's to give.
      id={resultId(id, value)}
    >
      <span className="mac-spotlight-result-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mac-spotlight-result-title">{children}</span>
    </div>
  );
}
