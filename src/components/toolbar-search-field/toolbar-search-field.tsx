"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import {
  Children,
  type ComponentProps,
  type CSSProperties,
  createContext,
  type ReactNode,
  type Ref,
  use,
  useId,
  useRef,
} from "react";
import { cn, withClassName } from "../../lib/cn";
import { ToolbarContext } from "../../lib/toolbar-context";
import "./toolbar-search-field.tokens.css";
import "./toolbar-search-field.css";

/** Set an input's value the way typing does, so React's `onChange` runs. */
function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Whether the field around a search menu button is disabled: the button then is, too. */
const FieldDisabledContext = createContext(false);

export interface ToolbarSearchFieldProps
  extends Omit<ComponentProps<"input">, "ref" | "size" | "type" | "className" | "style"> {
  /**
   * Text shown while the field is empty. It also names the field for assistive technology
   * unless an `aria-label` is given, and the clear button shows whenever it is not displayed.
   * Pass an empty string for a field without placeholder text, and name it with `aria-label`.
   * @default "Search"
   */
  placeholder?: string;
  /**
   * The fill of the bezel. `"standard"` is the field of nearly every toolbar (Finder, Notes,
   * System Preferences, Keychain Access). `"bright"` is the field Console has: in Dark Aqua
   * its fill is half as bright again and its placeholder lighter; in Aqua the two are the
   * same.
   * @default "standard"
   */
  variant?: "standard" | "bright";
  /** Called with the new text on every change, including when the field is cleared. */
  onValueChange?: (value: string) => void;
  /**
   * Accessible name of the clear button.
   * @default "Clear"
   */
  clearLabel?: string;
  /**
   * Tokens shown before the text, as in a Finder search by a criterion: one or more
   * `ToolbarSearchFieldToken`s. While there are tokens the placeholder is not shown and the
   * clear button is; the input is described by them for assistive technology. `null`,
   * `false`, an empty string and an empty array are no tokens.
   */
  tokens?: ReactNode;
  /**
   * A `ToolbarSearchFieldMenuButton`, shown in place of the magnifier: the magnifier with a
   * chevron beside it, which opens the field's search menu, as in Font Book. The field only
   * places the button; make it the trigger of a menu. The text then starts 4 pt later, and a
   * disabled field disables the button.
   */
  searchMenu?: ReactNode;
  /**
   * Called when the field is cleared with the clear button or Escape, after the text is
   * removed. A field with `tokens` removes them here.
   */
  onClear?: () => void;
  /** Class of the root element (the bezel). */
  className?: string;
  /** Style of the root element; set the field's `width` here. */
  style?: CSSProperties;
  /** Ref to the root element. */
  ref?: Ref<HTMLDivElement>;
  /** Ref to the `<input>`, to focus it or read its value. */
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * The search field of a toolbar (NSSearchField): the textured rounded bezel with a magnifier,
 * placeholder text and, once there is text, a clear button.
 *
 * It renders a native `<input type="search">` and passes every other prop to it, so `value`,
 * `defaultValue`, `onChange`, `name`, `disabled`, `readOnly` and `aria-*` work as on an input.
 * Escape clears the text, and a second Escape gives up focus; a read-only field is not cleared,
 * by Escape or by the clear button. Inside a `Toolbar` the input joins the toolbar's arrow-key
 * navigation. `tokens` puts search tokens before the text; the field does not keep them: it
 * reports a clear through `onClear`, and other keys through `onKeyDown`.
 */
export function ToolbarSearchField({
  placeholder = "Search",
  variant = "standard",
  onValueChange,
  clearLabel = "Clear",
  tokens,
  searchMenu,
  onClear,
  className,
  style,
  ref,
  inputRef,
  disabled,
  readOnly,
  onChange,
  onKeyDown,
  "aria-describedby": describedBy,
  ...props
}: ToolbarSearchFieldProps) {
  const inToolbar = use(ToolbarContext);
  const localRef = useRef<HTMLInputElement>(null);
  const tokensId = useId();
  const hasTokens = Children.toArray(tokens).some((token) => token !== "");
  const Input = inToolbar ? BaseToolbar.Input : "input";
  // `data-force` pins the focus ring in docs and visual tests; the ring is the root's.
  const force = (props as { "data-force"?: string })["data-force"];

  return (
    <div
      ref={ref}
      data-variant={variant}
      data-disabled={disabled ? "" : undefined}
      data-tokens={hasTokens ? "" : undefined}
      data-menu={searchMenu ? "" : undefined}
      data-force={force}
      className={cn("mac-toolbar-search-field", className)}
      style={style}
    >
      {searchMenu ? (
        <FieldDisabledContext value={Boolean(disabled)}>{searchMenu}</FieldDisabledContext>
      ) : (
        <svg className="mac-toolbar-search-field-glyph" viewBox="0 0 13 13" aria-hidden="true">
          <circle cx="5" cy="5" r="4.5" fill="none" stroke="currentColor" />
          <path d="M8.5 8.5l3.6 3.6" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      )}
      {hasTokens && (
        <span id={tokensId} className="mac-toolbar-search-field-tokens">
          {tokens}
        </span>
      )}
      <Input
        type="search"
        // The stylesheet hides the clear button while the placeholder shows, so without tokens
        // there is always one: a space when the caller wants no text. With tokens there is
        // none, which keeps the clear button in view.
        placeholder={hasTokens ? undefined : placeholder || " "}
        aria-label={props["aria-labelledby"] ? undefined : placeholder || undefined}
        aria-describedby={
          hasTokens ? (describedBy ? `${tokensId} ${describedBy}` : tokensId) : describedBy
        }
        disabled={disabled}
        readOnly={readOnly}
        className="mac-toolbar-search-field-input"
        ref={(node: HTMLInputElement | null) => {
          localRef.current = node;
          if (typeof inputRef === "function") return inputRef(node);
          if (inputRef) inputRef.current = node;
        }}
        onChange={(event) => {
          onChange?.(event);
          onValueChange?.(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.key !== "Escape" || event.defaultPrevented) return;
          if ((event.currentTarget.value || hasTokens) && !readOnly) {
            event.preventDefault();
            setInputValue(event.currentTarget, "");
            onClear?.();
          } else {
            event.currentTarget.blur();
          }
        }}
        {...props}
        data-force={undefined}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={clearLabel}
        disabled={disabled || readOnly}
        className="mac-toolbar-search-field-clear"
        onClick={() => {
          const input = localRef.current;
          if (!input) return;
          setInputValue(input, "");
          onClear?.();
          input.focus();
        }}
      >
        <svg viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="7" r="7" fill="currentColor" />
          <path
            className="mac-toolbar-search-field-clear-cross"
            d="M4.3 4.3l5.4 5.4m0-5.4l-5.4 5.4"
          />
        </svg>
      </button>
    </div>
  );
}

export interface ToolbarSearchFieldMenuButtonProps extends Omit<BaseButton.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * The search menu button of a `ToolbarSearchField`, passed in its `searchMenu`: the magnifier
 * with a small chevron, which opens a menu of what the field searches or of recent searches.
 *
 * Built on Base UI's Button, so it takes `disabled`, `render` and every native button
 * attribute; inside a `Toolbar` it joins the toolbar's arrow-key navigation. It is disabled
 * while its field is. It draws only the glyph: make it the trigger of a menu with the menu
 * trigger's `render`, and name it with `aria-label`.
 */
export function ToolbarSearchFieldMenuButton({
  className,
  children,
  disabled,
  ...props
}: ToolbarSearchFieldMenuButtonProps) {
  const fieldDisabled = use(FieldDisabledContext);
  const Button = (use(ToolbarContext) ? BaseToolbar.Button : BaseButton) as typeof BaseButton;
  return (
    <Button
      className={withClassName("mac-toolbar-search-field-menu", className)}
      disabled={disabled || fieldDisabled}
      {...props}
    >
      <svg viewBox="0 0 19 13" aria-hidden="true">
        {/* Font Book's magnifier is a little smaller than the plain field's. */}
        <circle cx="5.15" cy="5.15" r="4.15" fill="none" stroke="currentColor" />
        <path
          d="M8.4 8.4L12 11.5M12.1 4.5l1.85 1.75l1.95-1.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
      {children}
    </Button>
  );
}

export interface ToolbarSearchFieldTokenProps extends ComponentProps<"span"> {
  /**
   * What the value is matched against, set in small capitals before a chevron: Finder's
   * “Name”. Without it the token is the value alone.
   */
  criterion?: ReactNode;
}

/**
 * A token of a `ToolbarSearchField`, passed in its `tokens`: the value people searched for
 * and, joined before it, the criterion it is matched against. Its children are the value.
 */
export function ToolbarSearchFieldToken({
  criterion,
  className,
  children,
  ...props
}: ToolbarSearchFieldTokenProps) {
  return (
    <span className={cn("mac-toolbar-search-field-token", className)} {...props}>
      {criterion != null && (
        <span className="mac-toolbar-search-field-token-criterion">{criterion}</span>
      )}
      {/* Not laid out between the two flex items: it separates them in the token's text. */}
      {criterion != null && " "}
      <span className="mac-toolbar-search-field-token-value">{children}</span>
    </span>
  );
}
