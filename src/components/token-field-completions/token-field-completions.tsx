"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { TokenField, type TokenFieldProps } from "../token-field";
import "./token-field-completions.css";

const NONE: readonly string[] = [];

// Hang the list under the text being typed, wherever the tokens have pushed it.
function place(field: HTMLElement | null, popup: HTMLElement | null) {
  if (!field || !popup) return;
  popup.style.left = `${field.offsetLeft}px`;
  popup.style.top = `${field.offsetTop + field.offsetHeight}px`;
}

export interface TokenFieldCompletionsProps extends TokenFieldProps {
  /**
   * What can complete the typed text. A list is searched for the entries that contain the text,
   * ignoring case, leaving out those that are tokens already. A function is called with the
   * text and the tokens and returns the completions to show, in order
   * (`tokenField(_:completionsForSubstring:indexOfToken:indexOfSelectedItem:)`).
   */
  completions: readonly string[] | ((text: string, tokens: readonly string[]) => readonly string[]);
  /**
   * How long after the last keystroke the list appears, in milliseconds
   * (`NSTokenField.completionDelay`, which AppKit counts in seconds). While it runs no list is
   * shown.
   * @default 0
   */
  completionDelay?: number;
  /**
   * Accessible name of the list of completions.
   * @default "Completions"
   */
  completionsLabel?: string;
}

/**
 * A Catalina token field that suggests completions while typing, as Mail's address fields do:
 * a `TokenField` and the list under the text being typed. The text box is a combo box; Down
 * and Up Arrow move through the list, Return or a click takes a completion as a token, Escape
 * dismisses the list.
 *
 * The root element wraps the field and the list and takes `className`, `style` and `ref`;
 * every other prop is `TokenField`'s.
 */
export function TokenFieldCompletions({
  completions,
  completionDelay = 0,
  completionsLabel = "Completions",
  value,
  defaultValue,
  onValueChange,
  className,
  style,
  ref,
  inputRef,
  disabled,
  readOnly,
  onChange,
  onKeyDown,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: TokenFieldCompletionsProps) {
  const initial = useRef(defaultValue ?? NONE);
  const [inner, setInner] = useState(initial.current);
  const controlled = value !== undefined;
  const tokens = value ?? inner;
  // The text the list is shown for; empty while there is no list.
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);
  const list = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();

  const text = query.trim();
  const lower = text.toLowerCase();
  const matches =
    !text || disabled || readOnly
      ? NONE
      : typeof completions === "function"
        ? completions(text, tokens)
        : completions.filter(
            (item) => item.toLowerCase().includes(lower) && !tokens.includes(item),
          );
  const open = matches.length > 0;
  const index = Math.min(active, matches.length - 1);

  // Show the completions of `next` once the delay has passed without another keystroke.
  const suggest = (next: string) => {
    clearTimeout(timer.current);
    setActive(0);
    if (completionDelay > 0 && next.trim()) {
      setQuery("");
      timer.current = setTimeout(() => setQuery(next), completionDelay);
    } else {
      setQuery(next);
    }
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  // The list keeps the active completion in view, and is placed again after every render:
  // a new token moves the text box.
  useLayoutEffect(() => {
    place(input.current, list.current);
    list.current?.children[index]?.scrollIntoView?.({ block: "nearest" });
  });

  // Without a render the text box moves too: when the field is resized, its tokens wrap.
  useEffect(() => {
    const field = input.current;
    if (!open || !field || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => place(field, list.current));
    observer.observe(field);
    if (field.parentElement) observer.observe(field.parentElement);
    return () => observer.disconnect();
  }, [open]);

  // Resetting the form empties the text box, so the list goes and a pending one is dropped.
  // The tokens are held here so that a completion can be added to them; an uncontrolled field
  // therefore restores them here too, as the token field does for its own.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the `form` attribute decides which form the input belongs to, so the listener moves when it changes
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    // Once the event has been dispatched: another listener may still cancel the reset.
    const onReset = (event: Event) =>
      setTimeout(() => {
        if (event.defaultPrevented) return;
        clearTimeout(timer.current);
        setQuery("");
        setActive(0);
        if (controlled) return;
        // The field is given its tokens, so it does not hear the reset itself: a token that
        // had the keyboard hands it to the text here, as the field's own reset does.
        const field = input.current;
        if (field?.parentElement?.querySelector("[data-index]:focus")) field.focus();
        setInner(initial.current);
      });
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, props.form]);

  const commit = (next: string[]) => {
    if (!controlled) setInner(next);
    onValueChange?.(next);
  };

  // A completion replaces the typed text and becomes a token whole, tokenizing characters
  // included.
  const take = (completion: string) => {
    if (input.current) input.current.value = "";
    suggest("");
    commit([...tokens, completion]);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    // A key pressed while an input method composes is the input method's.
    if (!open || event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }
    const { key } = event;
    if (key === "ArrowDown" || key === "ArrowUp") {
      setActive((index + (key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
    } else if (key === "Enter") {
      take(matches[index] as string);
    } else if (key === "Escape") {
      suggest("");
    } else {
      return;
    }
    // The field must not act on the key as well: Return would make a token of the typed text.
    event.preventDefault();
  };

  const optionAt = (event: MouseEvent) => {
    const option = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
    return option ? Number(option.dataset.index) : -1;
  };

  return (
    <div ref={ref} className={cn("mac-token-field-completions", className)} style={style}>
      <TokenField
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${index}` : undefined}
        {...props}
        className="mac-token-field-completions-field"
        disabled={disabled}
        readOnly={readOnly}
        value={tokens}
        inputRef={(node) => {
          input.current = node;
          if (typeof inputRef === "function") return inputRef(node);
          if (inputRef) inputRef.current = node;
        }}
        onValueChange={(next) => {
          commit(next);
          // The field has taken the tokenised text out of the text box.
          suggest(input.current?.value ?? "");
        }}
        onChange={(event) => {
          onChange?.(event);
          // Text an input method is still composing is not completed.
          if (!(event.nativeEvent as InputEvent).isComposing) suggest(event.currentTarget.value);
        }}
        onCompositionStart={(event) => {
          onCompositionStart?.(event);
          // The list completed the text before the composition; it goes, a pending one too.
          suggest("");
        }}
        onCompositionEnd={(event) => {
          onCompositionEnd?.(event);
          suggest(event.currentTarget.value);
        }}
        onKeyDown={onInputKeyDown}
        onBlur={(event) => {
          onBlur?.(event);
          suggest("");
        }}
      />
      {open && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: the keys are handled on the text box, which keeps the focus
        <div
          ref={list}
          id={id}
          role="listbox"
          aria-label={completionsLabel}
          className="mac-token-field-completions-list"
          // Keeps the focus in the text box; losing it would make a token of the typed text.
          onMouseDown={(event) => event.preventDefault()}
          onMouseMove={(event) => {
            const over = optionAt(event);
            if (over >= 0) setActive(over);
          }}
          onClick={(event) => {
            const over = optionAt(event);
            if (over >= 0) take(matches[over] as string);
          }}
        >
          {matches.map((completion, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: completions are plain strings and may repeat
              key={i}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === index}
              tabIndex={-1}
              data-index={i}
              className="mac-token-field-completions-option"
            >
              {completion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
