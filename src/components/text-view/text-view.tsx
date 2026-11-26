"use client";

import { type ComponentProps, useRef } from "react";
import { cn } from "../../lib/cn";
import "./text-view.css";

/** Replace the selection of a textarea the way typing does, so the change handlers run. */
function insertText(area: HTMLTextAreaElement, text: string) {
  const start = area.selectionStart;
  const value = area.value.slice(0, start) + text + area.value.slice(area.selectionEnd);
  // Like typing, an insertion never takes the text past maxLength (-1 when there is none).
  if (area.maxLength >= 0 && value.length > area.maxLength) return;
  // The editing command keeps the insertion in the browser's undo history, which setting the
  // value does not. It is deprecated without a successor; where it is missing or refuses,
  // the value is set instead.
  if (area.ownerDocument.execCommand?.("insertText", false, text)) return;
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(area, value);
  area.selectionStart = area.selectionEnd = start + text.length;
  area.dispatchEvent(new Event("input", { bubbles: true }));
}

export interface TextViewProps extends ComponentProps<"textarea"> {
  /** Called with the new text on every change. */
  onValueChange?: (value: string) => void;
  /**
   * Sets the text in the fixed-pitch font, as Console and Terminal do.
   * @default false
   */
  monospace?: boolean;
  /**
   * Makes Tab insert a tab character, as in an AppKit text view, instead of moving to the
   * next control. Escape followed by Tab then leaves the view, so the keyboard is never
   * trapped.
   * @default false
   */
  insertsTab?: boolean;
}

/**
 * A Catalina text view (NSTextView) for plain text: multi-line text that fills its pane, with
 * no bezel and no focus ring.
 *
 * Base UI has no multi-line text primitive, so it is a native `<textarea>` and takes every
 * textarea attribute: `value`, `defaultValue`, `readOnly`, `disabled`, `placeholder`, `rows`.
 * It fills the width and height its parent gives it. For styled text use `RichTextView`.
 */
export function TextView({
  onValueChange,
  monospace = false,
  insertsTab = false,
  className,
  onChange,
  onKeyDown,
  ...props
}: TextViewProps) {
  /** Escape was the last key: the next Tab leaves the view. */
  const leaving = useRef(false);

  return (
    <textarea
      data-monospace={monospace ? "" : undefined}
      className={cn("mac-text-view", className)}
      onChange={(event) => {
        onChange?.(event);
        onValueChange?.(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!insertsTab || event.defaultPrevented) return;
        const plainTab =
          event.key === "Tab" &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey;
        if (plainTab && !leaving.current && !event.currentTarget.readOnly) {
          event.preventDefault();
          insertText(event.currentTarget, "\t");
        }
        leaving.current = event.key === "Escape";
      }}
      {...props}
    />
  );
}

export interface RichTextViewProps extends Omit<ComponentProps<"div">, "contentEditable"> {
  /**
   * Shows the text without letting it be edited; it can still be selected and copied.
   * @default false
   */
  readOnly?: boolean;
  /**
   * Dims the text and takes the view out of the tab order.
   * @default false
   */
  disabled?: boolean;
}

/**
 * A Catalina text view for rich text (NSTextView with `isRichText`): the same pane-filling
 * view, holding styled content that the browser edits in place.
 *
 * Its children are the initial content; it is uncontrolled, so read the result from the
 * element (`ref`, `onInput`). The browser's own editing commands apply (Command-B, Command-I,
 * undo). Give it an accessible name with `aria-label` or `aria-labelledby`.
 */
export function RichTextView({
  readOnly = false,
  disabled = false,
  className,
  children,
  ...props
}: RichTextViewProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a <textarea> cannot hold styled content
    <div
      role="textbox"
      aria-multiline="true"
      aria-readonly={readOnly || undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      data-rich=""
      data-disabled={disabled ? "" : undefined}
      className={cn("mac-text-view", className)}
      {...props}
      contentEditable={!readOnly && !disabled}
      suppressContentEditableWarning
    >
      {children}
    </div>
  );
}
