"use client";

import {
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import "./token-field.tokens.css";
import "./token-field.css";

// Set an input's value the way typing does, so the change handlers run.
function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export interface TokenFieldProps
  extends Omit<
    ComponentProps<"input">,
    "ref" | "size" | "type" | "value" | "defaultValue" | "className" | "style" | "children"
  > {
  /** The tokens, when controlled. Use with `onValueChange`. */
  value?: readonly string[];
  /** The tokens the field starts with, when uncontrolled. */
  defaultValue?: readonly string[];
  /** Called with the new list whenever a token is added or removed. */
  onValueChange?: (tokens: string[]) => void;
  /**
   * How a token is drawn (`NSTokenField.TokenStyle`): a tinted rounded rectangle, the same
   * with square corners, square and untinted until it is selected, or plain text.
   * @default "rounded"
   */
  tokenStyle?: "rounded" | "squared" | "plain-squared" | "none";
  /**
   * Draws the text field bezel around the tokens. Switch it off inside a surface that already
   * frames the field, as Mail's message header does.
   * @default true
   */
  bordered?: boolean;
  /**
   * Characters that end a token when typed or pasted. Return and leaving the field always do.
   * @default ","
   */
  tokenizingCharacters?: string;
  /**
   * Shows a chevron at the trailing end of each token, marking that it has a menu.
   * @default false
   */
  tokenMenu?: boolean;
  /**
   * Called when a token's menu is asked for: a click on its chevron, or Space or Down Arrow
   * while the token is selected. Open your menu anchored to `element`.
   */
  onTokenMenu?: (token: string, index: number, element: HTMLElement) => void;
  /**
   * Accessible name of the list of tokens.
   * @default "Tokens"
   */
  tokensLabel?: string;
  /** Class of the root element (the bezel). */
  className?: string;
  /** Style of the root element; set the field's `width` here. */
  style?: CSSProperties;
  /** Ref to the root element. */
  ref?: Ref<HTMLDivElement>;
  /** Ref to the `<input>` the text is typed into. */
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * A Catalina token field (NSTokenField): a text field whose entries become tokens, blocks of
 * text that are selected, moved over and deleted as units. The tokens are a list box of
 * options beside a native `<input>`, which takes every prop not listed here.
 */
export function TokenField({
  value,
  defaultValue,
  onValueChange,
  tokenStyle = "rounded",
  bordered = true,
  tokenizingCharacters = ",",
  tokenMenu = false,
  onTokenMenu,
  tokensLabel = "Tokens",
  className,
  style,
  ref,
  inputRef,
  name,
  form,
  disabled,
  readOnly,
  required,
  onChange,
  onKeyDown,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: TokenFieldProps) {
  const initial = useRef<readonly string[]>(defaultValue ?? []);
  const [inner, setInner] = useState<readonly string[]>(initial.current);
  // The token that has the focus, which is the selected one; null while the text has it.
  const [selected, setSelected] = useState<number | null>(null);
  const controlled = value !== undefined;
  const tokens = value ?? inner;
  const input = useRef<HTMLInputElement | null>(null);
  const list = useRef<HTMLSpanElement | null>(null);
  // After a removal: the token count it leaves and where the keyboard then goes.
  const focusAfterRender = useRef<[count: number, index: number] | null>(null);
  // An input method is composing: its intermediate text is not tokenised.
  const composing = useRef(false);
  const editable = !disabled && !readOnly;

  const focusToken = (index: number) => {
    const token = list.current?.children[index] as HTMLElement | undefined;
    (token ?? input.current)?.focus();
  };

  // Runs after every render: a removal that a controlled owner refused moves nothing.
  useEffect(() => {
    const pending = focusAfterRender.current;
    focusAfterRender.current = null;
    if (!pending || pending[0] !== tokens.length) return;
    focusToken(pending[1]);
    // Past the last token the keyboard is back in the text, and no focus event says so.
    if (pending[1] >= pending[0]) setSelected(null);
  });

  // Resetting the form restores the tokens an uncontrolled field started with, as it restores
  // the text of a native input. A controlled field is reset by its owner.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the `form` attribute decides which form the input belongs to, so the listener moves when it changes
  useEffect(() => {
    const form = input.current?.form;
    if (!form || controlled) return;
    // Once the event has been dispatched: another listener may still cancel the reset.
    const onReset = (event: Event) =>
      setTimeout(() => {
        if (event.defaultPrevented) return;
        // A reset blurs nothing: a token that had the keyboard hands it to the text.
        if (list.current?.querySelector(":focus")) input.current?.focus();
        setSelected(null);
        setInner(initial.current);
      });
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, form]);

  const commit = (next: string[]) => {
    if (!controlled) setInner(next);
    onValueChange?.(next);
  };

  // Turn everything before the last tokenizing character into tokens; the rest stays.
  const tokenizeDelimiters = (field: HTMLInputElement) => {
    const parts = [...field.value].reduce<string[]>(
      (all, char) => {
        if (tokenizingCharacters.includes(char)) all.push("");
        else all[all.length - 1] += char;
        return all;
      },
      [""],
    );
    if (parts.length === 1 || !editable) return;
    field.value = (parts.pop() as string).trimStart();
    const added = parts.map((part) => part.trim()).filter(Boolean);
    if (added.length > 0) commit([...tokens, ...added]);
  };

  // Turn the typed text into a token.
  const tokenizeText = () => {
    const field = input.current;
    const text = field?.value.trim();
    if (!field || !text || !editable) return false;
    field.value = "";
    commit([...tokens, text]);
    return true;
  };

  const onTokenKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const token = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (!token || disabled) return;
    const index = Number(token.dataset.index);
    switch (event.key) {
      case "ArrowLeft":
        focusToken(Math.max(0, index - 1));
        break;
      case "ArrowRight":
        focusToken(index + 1);
        break;
      case "Home":
        focusToken(0);
        break;
      case "End":
        input.current?.focus();
        break;
      case "Backspace":
      case "Delete": {
        if (!editable) return;
        // Backspace moves to the token before, Delete to the one after; past either end the
        // keyboard returns to the text.
        const after = event.key === "Backspace" && index > 0 ? index - 1 : index;
        focusAfterRender.current = [tokens.length - 1, after];
        commit(tokens.filter((_, i) => i !== index));
        break;
      }
      case " ":
      case "ArrowDown":
        if (tokenMenu) onTokenMenu?.(tokens[index] as string, index, token);
        break;
      default: {
        // Typing goes to the text, not to the selected token. The character is added here:
        // moving the focus during keydown does not reliably carry the keystroke with it.
        const field = input.current;
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey || !field) {
          return;
        }
        field.focus();
        if (editable && !(field.value.length >= field.maxLength && field.maxLength >= 0)) {
          setInputValue(field, field.value + event.key);
          field.setSelectionRange(field.value.length, field.value.length);
        }
        break;
      }
    }
    event.preventDefault();
  };

  const onTokenClick = (event: MouseEvent<HTMLSpanElement>) => {
    const target = event.target as HTMLElement;
    const token = target.closest<HTMLElement>("[data-index]");
    if (!token || disabled || !target.closest(".mac-token-field-token-menu")) return;
    const index = Number(token.dataset.index);
    onTokenMenu?.(tokens[index] as string, index, token);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a click on the bezel focuses the input, as a click on a native field's padding does; the input itself is the control
    <div
      ref={ref}
      data-token-style={tokenStyle}
      data-bordered={bordered ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      className={cn("mac-token-field", className)}
      style={style}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        input.current?.focus();
      }}
    >
      {tokens.length > 0 && (
        <span
          ref={list}
          role="listbox"
          aria-label={tokensLabel}
          aria-orientation="horizontal"
          aria-disabled={disabled || undefined}
          className="mac-token-field-tokens"
          onKeyDown={onTokenKeyDown}
          onClick={onTokenClick}
          onFocus={(event) => {
            const token = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
            setSelected(token ? Number(token.dataset.index) : null);
          }}
          onBlur={() => setSelected(null)}
        >
          {tokens.map((token, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: tokens are plain strings and may repeat
              key={index}
              role="option"
              aria-selected={selected === index}
              tabIndex={disabled ? undefined : -1}
              data-index={index}
              className="mac-token-field-token"
            >
              <span className="mac-token-field-token-text">{token}</span>
              {tokenMenu && (
                <span className="mac-token-field-token-menu">
                  <svg viewBox="0 0 6.25 3.65" aria-hidden="true">
                    <path d="M.75 .75 3.1 2.9 5.5 .75" />
                  </svg>
                </span>
              )}
            </span>
          ))}
        </span>
      )}
      <input
        type="text"
        autoComplete="off"
        {...props}
        form={form}
        ref={(node) => {
          input.current = node;
          if (typeof inputRef === "function") return inputRef(node);
          if (inputRef) inputRef.current = node;
        }}
        disabled={disabled}
        readOnly={readOnly}
        // One token satisfies `required`; the text being typed does while there is none.
        required={required && tokens.length === 0}
        aria-required={required || undefined}
        className="mac-token-field-input"
        onChange={(event) => {
          onChange?.(event);
          if (composing.current || (event.nativeEvent as InputEvent).isComposing) return;
          tokenizeDelimiters(event.currentTarget);
        }}
        onCompositionStart={(event) => {
          onCompositionStart?.(event);
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          onCompositionEnd?.(event);
          composing.current = false;
          // A tokenizing character that the composition produced counts once it is committed.
          tokenizeDelimiters(event.currentTarget);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          // Keys pressed during composition belong to the input method: Return confirms a
          // candidate, the arrows move inside it.
          // (Safari sends that Return after the composition has ended, as key code 229.)
          if (
            event.defaultPrevented ||
            composing.current ||
            event.nativeEvent.isComposing ||
            event.keyCode === 229
          ) {
            return;
          }
          const field = event.currentTarget;
          if (event.key === "Enter") {
            // Return ends the token; in an empty field it is left to the form.
            if (tokenizeText()) event.preventDefault();
          } else if (
            (event.key === "Backspace" || event.key === "ArrowLeft") &&
            field.selectionStart === 0 &&
            field.selectionEnd === 0 &&
            tokens.length > 0
          ) {
            event.preventDefault();
            focusToken(tokens.length - 1);
          }
        }}
        onBlur={(event) => {
          onBlur?.(event);
          tokenizeText();
        }}
      />
      {name !== undefined && (
        <input
          type="hidden"
          name={name}
          form={form}
          value={tokens.join(tokenizingCharacters[0] ?? ",")}
          disabled={disabled}
        />
      )}
    </div>
  );
}
