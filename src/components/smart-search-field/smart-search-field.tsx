"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { Input as BaseInput } from "@base-ui/react/input";
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import {
  type ComponentProps,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type Ref,
  use,
  useRef,
  useState,
} from "react";
import { cn, withClassName } from "../../lib/cn";
import { ToolbarContext } from "../../lib/toolbar-context";
import "./smart-search-field.tokens.css";
import "./smart-search-field.css";

/*
 * The glyphs, drawn for this library. Each is "width height|stroked path|filled path|stroke
 * width", the last two optional; one unit is one point. The reload glyph's box is a point
 * taller than its drawing, which sets the drawing half a point above the field's centre, where
 * Safari has it. The stroked and the filled path never overlap: the glyph colours are
 * translucent.
 */
const GLYPHS: Record<string, string> = {
  reader: "14 10|M0 .5h14M0 3.5h14M0 6.5h14M0 9.5h8",
  reload: "11 14|M5 2.53a5 5 0 1 0 5.4 3.97|M5 0l4.4 2.75L5 5.5z",
  stop: "10 10|M.5.5l9 9m0-9l-9 9",
  "text-size":
    "17 11|M.7 11 3 4.4h.9L6.2 11M1.7 8.9h3.5|M7.3 11 11.3.5h1.4l4 10.5h-1.45l-1.3-3.4h-3.9L8.75 11zM10.46 6.5h3.08L12 2.47z|.85",
  audio:
    "16 12|M10.4 3.05a4.5 4.5 0 0 1 0 5.9M13.42.42a8.5 8.5 0 0 1 0 11.16|M0 4h3.5L8 .5v11L3.5 8H0z|.75",
  lock: "8 10|M1.5 4V2.5a2.5 2 0 0 1 5 0V4|M0 4h8v6H0z",
  search: "12.5 12.5|M9.5 5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM8.3 8.3l3.8 3.8",
};

function Glyph({ name }: { name: string }) {
  const [box = "", stroke, fill, strokeWidth] = (GLYPHS[name] ?? "").split("|");
  const [width, height] = box.split(" ");
  return (
    <svg
      className="mac-smart-search-field-glyph"
      data-glyph={name}
      width={width}
      height={height}
      viewBox={`0 0 ${box}`}
      aria-hidden="true"
    >
      {fill && <path d={fill} />}
      <path d={stroke} strokeWidth={strokeWidth} />
    </svg>
  );
}

// What Safari shows of an address while the field is not being edited: its host, without the
// scheme, a user name and password, a leading "www.", the path, the query and the fragment.
// A backslash ends the host as a slash does: that is how browsers read an http address.
const hostOf = (text: string) =>
  text.replace(/^[a-z][\w+.-]*:\/\/(?:[^/\\?#]*@)?(?:www\.)?([^/\\?#]*).*$/i, "$1");

export interface SmartSearchFieldProps
  extends Omit<
    ComponentProps<"input">,
    | "ref"
    | "size"
    | "type"
    | "className"
    | "style"
    | "children"
    | "value"
    | "defaultValue"
    | "onSubmit"
  > {
  /** The text of the field, usually the page's address. Makes the field controlled. */
  value?: string;
  /**
   * The text an uncontrolled field starts with.
   * @default ""
   */
  defaultValue?: string;
  /**
   * Called with the new text on every change: while typing, and when Escape puts the text
   * back.
   */
  onValueChange?: (value: string) => void;
  /**
   * Called with the text when Return is pressed: load the address or run the search. The
   * field then gives up the keyboard focus and shows the text centred again. Return is the
   * field's own key: it does not submit a form the field is in.
   */
  onSubmit?: (value: string) => void;
  /**
   * What the field shows, centred, while it is not being edited. By default the host of an
   * address (`https://www.example.com/page` shows as `example.com`; a user name and password
   * in the address are never shown) and any other text as it is.
   */
  displayValue?: ReactNode;
  /**
   * Draws a padlock before the centred text, as for a page loaded over HTTPS.
   * @default false
   */
  secure?: boolean;
  /**
   * Text shown, with a magnifying glass, while the field is empty. It also names the field for
   * assistive technology unless an `aria-label` or `aria-labelledby` is given.
   * @default "Search or enter website name"
   */
  placeholder?: string;
  /** Accessory at the leading edge, inside the bezel: the Reader button. */
  leading?: ReactNode;
  /** Accessories at the trailing edge, inside the bezel: Reload or Stop, the audio button. */
  trailing?: ReactNode;
  /** Class of the root element (the bezel). */
  className?: string;
  /** Style of the root element; the field is as wide as its container unless `width` is set. */
  style?: CSSProperties;
  /** Ref to the root element. */
  ref?: Ref<HTMLDivElement>;
  /** Ref to the `<input>`, to focus it or read its value. */
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * Safari's Smart Search field: the address and search field of a toolbar. It shows the page's
 * host, centred, until it is edited, then the whole text, selected. Built on Base UI's Input;
 * every prop that is not its own goes to the `<input>`.
 */
export function SmartSearchField({
  value,
  defaultValue = "",
  onValueChange,
  onSubmit,
  displayValue,
  secure = false,
  placeholder = "Search or enter website name",
  leading,
  trailing,
  className,
  style,
  ref,
  inputRef,
  disabled,
  onChange,
  onFocus,
  onKeyDown,
  onMouseDown,
  ...props
}: SmartSearchFieldProps) {
  // Either way an <input> is rendered and takes an input's props.
  const Input = (use(ToolbarContext) ? BaseToolbar.Input : BaseInput) as ComponentType<
    ComponentProps<"input">
  >;
  const [own, setOwn] = useState(defaultValue);
  const text = value ?? own;
  // The text to go back to on Escape: what the field held when editing began or last submitted.
  const committed = useRef(text);
  const setText = (next: string) => {
    setOwn(next);
    onValueChange?.(next);
  };
  // `data-force` pins the editing look in docs and visual tests; the look is the root's.
  const force = (props as { "data-force"?: string })["data-force"];

  return (
    <div
      ref={ref}
      data-empty={text ? undefined : ""}
      data-secure={secure ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-force={force}
      className={cn("mac-smart-search-field", className)}
      style={style}
    >
      {leading ? <span className="mac-smart-search-field-leading">{leading}</span> : null}
      <Glyph name="search" />
      <Input
        autoCapitalize="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-label={props["aria-labelledby"] ? undefined : placeholder}
        disabled={disabled}
        className="mac-smart-search-field-input"
        ref={inputRef}
        value={text}
        onChange={(event) => {
          onChange?.(event);
          setText(event.currentTarget.value);
        }}
        onMouseDown={(event) => {
          onMouseDown?.(event);
          // The click that begins editing selects the whole text instead of placing the caret.
          if (!event.defaultPrevented && document.activeElement !== event.currentTarget) {
            event.preventDefault();
            event.currentTarget.focus();
          }
        }}
        onFocus={(event) => {
          onFocus?.(event);
          committed.current = text;
          event.currentTarget.select();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          // A key pressed while an input method composes is the input method's.
          if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229) {
            return;
          }
          if (event.key === "Enter") {
            committed.current = text;
            onSubmit?.(text);
          } else if (event.key === "Escape") {
            if (text !== committed.current) setText(committed.current);
          } else {
            return;
          }
          // The key is the field's: Return does not also submit a form around it, and Escape
          // does not also dismiss a dialog it is in.
          event.preventDefault();
          event.currentTarget.blur();
        }}
        {...props}
        data-force={undefined}
      />
      <span className="mac-smart-search-field-display" aria-hidden="true">
        {text ? secure && <Glyph name="lock" /> : <Glyph name="search" />}
        <span className="mac-smart-search-field-text">
          {text ? (displayValue ?? hostOf(text)) : placeholder}
        </span>
      </span>
      {trailing ? <span className="mac-smart-search-field-trailing">{trailing}</span> : null}
    </div>
  );
}

export interface SmartSearchFieldButtonProps extends Omit<BaseButton.Props, "ref"> {
  /**
   * One of the field's own glyphs: `"reader"` (lines of text), `"reload"`, `"stop"`,
   * `"text-size"` (a small and a large A, the Reader's text options) or `"audio"` (a
   * speaker). Children, when given, are drawn instead.
   */
  glyph?: "reader" | "reload" | "stop" | "text-size" | "audio";
  /**
   * Makes the button a toggle and says whether it is on: `true` draws the filled "on" look of
   * the Reader button and sets `aria-pressed`. Switch it in `onClick`. A button without it is
   * momentary.
   */
  pressed?: boolean;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A glyph button inside a `SmartSearchField`, for its `leading` and `trailing` props. Built on
 * Base UI's Button; it needs an `aria-label`.
 */
export function SmartSearchFieldButton({
  glyph,
  pressed,
  className,
  children,
  ...props
}: SmartSearchFieldButtonProps) {
  const Button = (use(ToolbarContext) ? BaseToolbar.Button : BaseButton) as typeof BaseButton;
  return (
    <Button
      aria-pressed={pressed}
      data-pressed={pressed ? "" : undefined}
      className={withClassName("mac-smart-search-field-button", className)}
      {...props}
    >
      {children ?? (glyph && <Glyph name={glyph} />)}
    </Button>
  );
}
