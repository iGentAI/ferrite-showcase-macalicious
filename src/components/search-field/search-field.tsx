"use client";

import { Input as BaseInput } from "@base-ui/react/input";
import { type CSSProperties, type Ref, useRef } from "react";
import { cn } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./search-field.tokens.css";
import "./search-field.css";

/** Set an input's value the way typing does, so the change handlers run. */
function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/*
 * How search-field.css draws it (kept here; the stylesheet is at its size budget).
 *
 * - The root's box is the bezel's outer edge. Its ::before draws the bezel; the input fills
 *   the root and is transparent. The cancel button is hidden while the placeholder shows,
 *   which needs no state.
 * - States: [data-variant="sidebar" | "store"]; [data-size="small" | "mini"]; :focus-within
 *   draws the focus ring, 3 pt outside the edge and over the edge itself, in the key window
 *   only; [data-disabled] is the whole field at half opacity; [data-readonly] has no cancel
 *   button; [data-search-menu] has a chevron beside the glass, which is then a button; under
 *   [data-window-state="main" | "inactive"] there is no ring and the selection is grey;
 *   [data-force~="focus"] on the input is a static preview of the ring.
 * - Hook: --mac-search-field-height replaces the height the variant and size give; the glass
 *   and the cancel button stay centred.
 * - The store field centres its glass and placeholder together while it is empty and does
 *   not have the keyboard, as NSSearchField does with centersPlaceholder. The width of the
 *   placeholder is not known to the stylesheet, so that state shows a copy of both
 *   (.mac-search-field-rest) in a centred row and hides the real ones. The row is centred by
 *   two flexible spacers, not by justify-content, so that a placeholder too long for the
 *   field starts after the glass and is cut off at the trailing edge. The copy is one
 *   clipped line, as a placeholder is. A store field with a search menu is never centred:
 *   its glass is the menu's button and stays where the button is. A forced focus preview
 *   (data-force) is laid out as real focus is. It is 26 pt high with
 *   a 1 pt edge in one colour and 12 pt text; its corner is fitted to the App Store captures
 *   (4 pt scores 0.04%, 4.5 pt 0.17% and 5 pt 0.41%: bezel alone, 2x, Aqua).
 * - Sizes. The sidebar field is 23 pt high at the regular size (Music). Small is measured on
 *   Automator's field; mini is provisional. The small corner is the field's own: at 4 pt the
 *   rendered bezel is closest to Automator's (3.75 pt ties; the control radius of 3.5 pt and
 *   the spec's fits of 2.5 and 4.25 pt are further off).
 * - The glass sits half to three quarters of a point below the centre. Its stroke keeps its
 *   width in points whatever the glyph's size; the handle is a little heavier than the ring.
 * - Provisional: the search menu (the text starts 6 pt later to make room for the chevron,
 *   and an invisible button covers the glass and the chevron), the cancel button (a disc
 *   4 pt from the trailing edge) and the disabled look (the whole field at half opacity).
 * - The focus ring shows whenever the field has the keyboard, in the key window only: a band
 *   from 3 pt outside the edge to the edge's inner side, concentric with the bezel, so it
 *   covers the edge but not the fill (Automator: outer corner 6.5 pt around a 3.5 pt corner).
 */

/** The magnifying glass; with a search menu, its chevron outside the glass's 12.5 pt box. */
function Glass({ chevron }: { chevron?: boolean }) {
  return (
    <svg className="mac-search-field-glyph" viewBox="0 0 12.5 12.5" aria-hidden="true">
      <circle cx="5" cy="5" r="4.5" />
      <path d="M8.4 8.4 11.8 11.8" />
      {chevron && <path d="M13.4 5.4 15.2 7.2 17 5.4" />}
    </svg>
  );
}

export interface SearchFieldProps
  extends Omit<BaseInput.Props, "ref" | "size" | "type" | "className" | "style" | "children"> {
  /**
   * Bezel. `"standard"` is the text-background field of a window's content; `"sidebar"` is
   * the translucent grey field that Catalina draws on a sidebar (Automator's library, Music);
   * `"store"` is the taller field with a 1 pt edge of the App Store's sidebar, whose glass and
   * placeholder are centred until the field takes the keyboard or holds text (with
   * `searchMenu` they stay at the leading edge).
   * @default "standard"
   */
  variant?: "standard" | "sidebar" | "store";
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * Text shown while the field is empty. It also names the field for assistive technology
   * unless a label or an `aria-label` is given.
   * @default "Search"
   */
  placeholder?: string;
  /**
   * Accessible name of the cancel button, which appears once the field holds text.
   * @default "Clear"
   */
  clearLabel?: string;
  /**
   * Gives the field a search menu, as for recent searches: a chevron is drawn beside the
   * magnifying glass and the glass becomes a button. The field does not draw the menu; it
   * asks for it through `onSearchMenu`.
   * @default false
   */
  searchMenu?: boolean;
  /**
   * Called when the search menu is asked for: a click on the magnifying glass, or Down Arrow
   * in the field. Open your menu anchored to `anchor`, the field's root element.
   */
  onSearchMenu?: (anchor: HTMLElement) => void;
  /**
   * Accessible name of the magnifying glass button of a field with a search menu.
   * @default "Recent searches"
   */
  searchMenuLabel?: string;
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
 * A Catalina search field in a window's content (NSSearchField): a rounded field with a
 * magnifying glass, placeholder text and, once it holds text, a cancel button.
 *
 * Built on Base UI's Input with `type="search"`, so it accepts `value`, `defaultValue`,
 * `onValueChange`, `disabled` and every native input attribute; those go to the `<input>`.
 * Escape clears the text, and a second Escape gives up the keyboard focus; a `readOnly`
 * field cannot be cleared and shows no cancel button. With `searchMenu`, Down Arrow and a
 * click on the glass ask for the menu of recent searches. For the field of a toolbar use
 * `ToolbarSearchField`.
 */
export function SearchField({
  variant = "standard",
  size = "regular",
  placeholder = "Search",
  clearLabel = "Clear",
  searchMenu = false,
  onSearchMenu,
  searchMenuLabel = "Recent searches",
  className,
  style,
  ref,
  inputRef,
  disabled,
  readOnly,
  onKeyDown,
  ...props
}: SearchFieldProps) {
  const localRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      ref={ref}
      data-variant={variant}
      data-size={size}
      data-disabled={disabled ? "" : undefined}
      data-readonly={readOnly ? "" : undefined}
      data-search-menu={searchMenu ? "" : undefined}
      className={cn("mac-search-field", className)}
      style={style}
    >
      <Glass chevron={searchMenu} />
      {searchMenu && (
        <button
          type="button"
          tabIndex={-1}
          aria-haspopup="menu"
          aria-label={searchMenuLabel}
          disabled={disabled}
          className="mac-search-field-menu"
          onClick={(event) => onSearchMenu?.(event.currentTarget.parentElement as HTMLElement)}
        />
      )}
      <BaseInput
        type="search"
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className="mac-search-field-input"
        ref={(node: HTMLElement | null) => {
          localRef.current = node as HTMLInputElement | null;
          if (typeof inputRef === "function") return inputRef(localRef.current);
          if (inputRef) inputRef.current = localRef.current;
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          // A key pressed while an input method composes is the input method's: Escape cancels
          // its candidate, the arrows move through its candidates.
          // (Safari sends some of those keys after the composition has ended, as key code 229.)
          if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229) {
            return;
          }
          const input = event.currentTarget as HTMLInputElement;
          if (event.key === "ArrowDown" && searchMenu) {
            event.preventDefault();
            onSearchMenu?.(input.parentElement as HTMLElement);
          }
          if (event.key !== "Escape") return;
          // A read-only field keeps its text: Escape only gives up the focus.
          if (input.value && !readOnly) {
            event.preventDefault();
            setInputValue(input, "");
          } else {
            input.blur();
          }
        }}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={clearLabel}
        disabled={disabled || readOnly}
        className="mac-search-field-clear"
        onClick={() => {
          const input = localRef.current;
          if (!input || readOnly) return;
          setInputValue(input, "");
          input.focus();
        }}
      >
        {/* A disc with the cross cut out of it, so the field's fill shows through. */}
        <svg viewBox="0 0 14 14" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M7 0a7 7 0 1 0 0 14A7 7 0 1 0 7 0zM8.91 4.1 9.9 5.09 7.99 7 9.9 8.91 8.91 9.9 7 7.99 5.09 9.9 4.1 8.91 6.01 7 4.1 5.09 5.09 4.1 7 6.01z"
          />
        </svg>
      </button>
      {variant === "store" && !searchMenu && (
        <span className="mac-search-field-rest" aria-hidden="true">
          <Glass />
          {/* An input drops the line breaks of its placeholder; so does the copy. */}
          {placeholder.replace(/[\n\r]/g, "")}
        </span>
      )}
    </div>
  );
}
