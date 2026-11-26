"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { useRender } from "@base-ui/react/use-render";
import {
  type CSSProperties,
  cloneElement,
  createContext,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  use,
  useMemo,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { useControlled } from "../../lib/use-controlled";
import "./sticky-note.tokens.css";
import "./sticky-note.css";

const CollapseContext = createContext<{
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}>({ collapsed: false, setCollapsed: () => {} });

export interface StickyNoteProps extends useRender.ComponentProps<"div"> {
  /**
   * The note colour, one of the six in Stickies' Color menu.
   * @default "yellow"
   */
  color?: "yellow" | "blue" | "green" | "pink" | "purple" | "gray";
  /**
   * Whether the note is collapsed to its title bar (Window > Collapse). Controlled; use
   * `defaultCollapsed` to only set the initial state.
   */
  collapsed?: boolean;
  /**
   * Whether the note starts collapsed, when `collapsed` is not given.
   * @default false
   */
  defaultCollapsed?: boolean;
  /**
   * Called with the new state when the collapse widget is clicked or the title bar is
   * double-clicked.
   */
  onCollapsedChange?: (collapsed: boolean) => void;
  /**
   * Makes the whole note see-through (Window > Translucent Window).
   * @default false
   */
  translucent?: boolean;
  /**
   * The window state of the note, written to `data-window-state`. Only the key note shows the
   * coloured title strip and its widgets.
   * @default "key"
   */
  state?: "key" | "main" | "inactive";
}

/**
 * A note of Stickies: a small coloured window with square corners that holds text.
 *
 * It is a window of its own: it writes its `state` to `data-window-state`, and a window manager
 * decides which note is key. Put a `StickyNoteTitleBar` and a `StickyNoteText` inside, give it a
 * size with `style` or a class, and name it with `aria-label` (the first line of its text).
 * Renders a `<div role="group">`; Base UI's `render` prop renders another element.
 */
export function StickyNote({
  color = "yellow",
  collapsed: controlled,
  defaultCollapsed = false,
  onCollapsedChange,
  translucent = false,
  state = "key",
  className,
  style,
  render,
  ref,
  children,
  ...props
}: StickyNoteProps) {
  const [collapsed, setCollapsed] = useControlled(controlled, defaultCollapsed, onCollapsedChange);
  const context = useMemo(() => ({ collapsed, setCollapsed }), [collapsed, setCollapsed]);
  // A collapsed note is its title bar, whatever minimum height its owner gave it: inline, so
  // that it beats a class rule, and on a rendered element too (given as it is or returned by
  // a function), whose own style would win.
  const flat = collapsed ? { minHeight: 0 } : undefined;
  const flatten = (element: ReactElement) =>
    cloneElement(element as ReactElement<{ style?: CSSProperties }>, {
      style: { ...(element.props as { style?: CSSProperties }).style, ...flat },
    });
  return useRender({
    defaultTagName: "div",
    render:
      flat && render
        ? typeof render === "function"
          ? (given, state) => flatten(render(given, state))
          : flatten(render)
        : render,
    ref,
    props: {
      role: "group",
      "data-color": color,
      "data-collapsed": collapsed ? "" : undefined,
      "data-translucent": translucent ? "" : undefined,
      "data-window-state": state,
      ...props,
      className: cn("mac-sticky-note", className),
      style: flat ? { ...style, ...flat } : style,
      children: <CollapseContext value={context}>{children}</CollapseContext>,
    },
  });
}

export interface StickyNoteTitleBarProps extends useRender.ComponentProps<"div"> {
  /** The note's title, shown in the strip while the note is collapsed: the first line of its text. */
  children?: ReactNode;
  /** Called when the close box is activated. Removing the note is the application's job. */
  onClose?: () => void;
  /** Called when the zoom box is activated. Resizing the note is the application's job. */
  onZoom?: () => void;
  /**
   * Accessible name of the close box.
   * @default "Close"
   */
  closeLabel?: string;
  /**
   * Accessible name of the zoom box.
   * @default "Zoom"
   */
  zoomLabel?: string;
  /**
   * Accessible name of the collapse box, a toggle button that is pressed while the note is
   * collapsed.
   * @default "Collapse"
   */
  collapseLabel?: string;
}

/**
 * The 12 pt title strip of a sticky note with its three widgets: the close box at the left, the
 * zoom and collapse boxes at the right. Double-clicking the strip collapses or expands the note.
 *
 * The strip is coloured and the widgets are shown only in the key note; in any other note the
 * band stays, in the note's own colour, so the text does not move.
 */
export function StickyNoteTitleBar({
  onClose,
  onZoom,
  closeLabel = "Close",
  zoomLabel = "Zoom",
  collapseLabel = "Collapse",
  className,
  render,
  ref,
  children,
  onDoubleClick,
  ...props
}: StickyNoteTitleBarProps) {
  const { collapsed, setCollapsed } = use(CollapseContext);
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      ...props,
      className: cn("mac-sticky-note-title-bar", className),
      onDoubleClick(event: MouseEvent<HTMLDivElement>) {
        onDoubleClick?.(event);
        if (event.defaultPrevented || (event.target as Element).closest("button")) return;
        setCollapsed(!collapsed);
      },
      children: (
        <>
          <BaseButton
            className="mac-sticky-note-widget"
            data-widget="close"
            aria-label={closeLabel}
            onClick={onClose}
          />
          <span className="mac-sticky-note-title">{children}</span>
          <BaseButton
            className="mac-sticky-note-widget"
            data-widget="zoom"
            aria-label={zoomLabel}
            onClick={onZoom}
          />
          <BaseButton
            className="mac-sticky-note-widget"
            data-widget="collapse"
            aria-label={collapseLabel}
            aria-pressed={collapsed}
            onClick={() => setCollapsed(!collapsed)}
          />
        </>
      ),
    },
  });
}

export interface StickyNoteTextProps
  extends Omit<useRender.ComponentProps<"div">, "contentEditable"> {
  /**
   * Shows the text without letting it be edited; it can still be selected and copied.
   * @default false
   */
  readOnly?: boolean;
}

/**
 * The text of a sticky note: Helvetica 12 on a 14 pt line, edited in place by the browser.
 *
 * Its children are the initial content and it is uncontrolled: later children are ignored (give
 * it another `key` to replace the text), and the result is read from the element (`ref`,
 * `onInput`). Give it text and plain markup only (`<b>`, `<i>`, line breaks): a component with
 * state of its own would go on rendering into text the browser has edited. Line breaks in a
 * string are kept. It is a multi-line text box
 * named "Note"; pass `aria-label` or `aria-labelledby` for another name.
 */
export function StickyNoteText({
  readOnly = false,
  className,
  render,
  ref,
  children,
  ...props
}: StickyNoteTextProps) {
  // The browser owns the text once it is edited: React is given the first children on every
  // render, so a later render of the owner neither overwrites an edit nor reconciles into
  // edited nodes. That holds for static markup; see the note on children above.
  const [initial] = useState(children);
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "textbox",
      "aria-multiline": true,
      "aria-readonly": readOnly || undefined,
      "aria-label": "Note",
      tabIndex: 0,
      ...props,
      className: cn("mac-sticky-note-text", className),
      children: initial,
      contentEditable: !readOnly,
      suppressContentEditableWarning: true,
    },
  });
}
