"use client";

import { useRender } from "@base-ui/react/use-render";
import {
  type ComponentProps,
  type CSSProperties,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
} from "react";
import { cn } from "../../lib/cn";
import { windowDragRegion } from "../../lib/window-drag-region";
import { TitleBar, type TitleBarProps } from "../title-bar";
import "./catalyst-chrome.tokens.css";
import "./catalyst-chrome.css";

/* Toolbar items are 7 pt apart in these apps: the toolbar's own hook, set for this bar. */
const TOOLBAR_GAP = { "--mac-toolbar-gap": "7px" } as CSSProperties;

const WIDTH = "--mac-catalyst-chrome-sidebar-width";

export interface CatalystChromeProps extends Omit<ComponentProps<"div">, "title"> {
  /**
   * What runs along the window's top edge. `"toolbar"` is the 38 pt toolbar row of News,
   * Stocks, Home and Voice Memos. `"none"` is Find My: no bar is drawn, the window controls
   * float 8 pt from the edge in a 22 pt strip over the sidebar, and the sidebar and the
   * content start at the window's top edge. `title` and `toolbar` are then not drawn: name the
   * `Window` with `aria-label`, and give it `topHighlight`.
   * @default "toolbar"
   */
  bar?: "toolbar" | "none";
  /** The window title, centred over the toolbar row. It names the window. */
  title?: ReactNode;
  /** The close, minimize and zoom buttons: a `WindowControls` element. */
  controls?: ReactNode;
  /** The toolbar: a `Toolbar` with toolbar buttons, a segmented control or a search field. */
  toolbar?: ReactNode;
  /**
   * The primary column: a `CatalystSidebar`. Without it the content takes the whole width.
   * The chrome copies the sidebar's width, its `width` or the
   * `--mac-catalyst-chrome-sidebar-width` in its `style`, to that variable on its own root,
   * for the Dark Aqua toolbar's darker stretch over the column. A sidebar wrapped in a
   * component of your own, or one whose width a stylesheet sets, needs the variable in the
   * chrome's `style` too.
   */
  sidebar?: ReactNode;
  /**
   * Lets the content run under the toolbar, which then shows it through the translucent
   * toolbar material, as Home and Voice Memos do. The content then starts at the window's top
   * edge; pad it by `var(--mac-catalyst-chrome-toolbar-inset)` (38 pt) where it must clear
   * the toolbar.
   * @default false
   */
  underToolbar?: boolean;
  /**
   * Called when the toolbar's own surface is pressed, or the strip of a chrome without a bar:
   * a window manager starts a move here. A press that a handler before it cancelled with
   * `preventDefault` (a `Window`'s `onPointerDownCapture`, say) is not reported.
   */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /**
   * Called when that surface is double-clicked: macOS zooms the window. A cancelled double
   * click is not reported.
   */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /** The app's content: the iPad view hierarchy, on the content background. */
  children?: ReactNode;
}

/**
 * The chrome of a Mac Catalyst app (News, Stocks, Home, Voice Memos): the 38 pt toolbar row
 * with the window controls and the centred title, an optional sidebar in iPad metrics, and
 * the content. Put it in a `Window`. With `bar="none"` it is Find My's: no toolbar row, the
 * window controls over a sidebar of the window's whole height.
 *
 * The toolbar row is the library's `TitleBar` in its title-hidden layout, so the window
 * controls, the toolbar's keyboard navigation and the window's name work as in any window.
 * Attributes and `ref` go to the root; the content is a plain `<div>`.
 */
export function CatalystChrome({
  bar = "toolbar",
  title,
  controls,
  toolbar,
  sidebar,
  underToolbar = false,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  className,
  style,
  children,
  ...props
}: CatalystChromeProps) {
  // The column's width as the sidebar has it: the variable in its style, else its `width`.
  const column =
    isValidElement<CatalystSidebarProps>(sidebar) && sidebar.type === CatalystSidebar
      ? ((sidebar.props.style as Record<string, string> | undefined)?.[WIDTH] ??
        `${sidebar.props.width ?? 227}px`)
      : undefined;
  // The strip is a drag region as a title bar is, and like one it keeps a window's veto: a
  // press or a double click that a handler before it has cancelled (a `Window`'s
  // `onPointerDownCapture` or `onDoubleClickCapture` calling `preventDefault`) does not move
  // or zoom the window. `windowDragRegion` checks that itself.
  const strip = windowDragRegion<HTMLDivElement>(onDragRegionPointerDown, onDragRegionDoubleClick);
  return (
    <div
      data-bar={bar}
      data-under-toolbar={underToolbar ? "" : undefined}
      {...props}
      className={cn("mac-catalyst-chrome", className)}
      style={{ [WIDTH]: column, ...style } as typeof style}
    >
      {bar === "none" ? (
        <div className="mac-catalyst-chrome-strip" {...strip}>
          {controls}
        </div>
      ) : (
        <TitleBar
          variant="title-hidden"
          title={title}
          controls={controls}
          className="mac-catalyst-chrome-bar"
          onDragRegionPointerDown={onDragRegionPointerDown}
          onDragRegionDoubleClick={onDragRegionDoubleClick}
        >
          {toolbar == null || toolbar === false ? null : (
            <div className="mac-catalyst-chrome-toolbar" style={TOOLBAR_GAP}>
              {toolbar}
            </div>
          )}
        </TitleBar>
      )}
      <div className="mac-catalyst-chrome-body">
        {sidebar}
        <div className="mac-catalyst-chrome-content">{children}</div>
      </div>
    </div>
  );
}

export interface CatalystSidebarProps extends ComponentProps<"nav"> {
  /**
   * Width of the column in points, without its divider: 227 in News, 330 in Stocks. It sets
   * `--mac-catalyst-chrome-sidebar-width`.
   * @default 227
   */
  width?: number;
  /**
   * How the column ends. `"line"` is the News divider: one point after the column, then half
   * a point of shade over the content. `"shade"` is the Stocks one: the column's last half
   * point is shaded and nothing follows it, so the column is exactly `width` wide. `"plain"`
   * is the Find My one: the point after the column and nothing over the content.
   * @default "line"
   */
  divider?: "line" | "shade" | "plain";
}

/**
 * The sidebar of a Catalyst app: a `nav` landmark that holds `CatalystSidebarGroup`s of
 * `CatalystSidebarItem`s, or a custom list such as the Stocks watchlist. Give it an
 * `aria-label`.
 */
export function CatalystSidebar({
  width = 227,
  divider = "line",
  className,
  style,
  children,
  ...props
}: CatalystSidebarProps) {
  return (
    <nav
      data-divider={divider}
      {...props}
      className={cn("mac-catalyst-chrome-sidebar", className)}
      style={{ [WIDTH]: `${width}px`, ...style } as typeof style}
    >
      <div className="mac-catalyst-chrome-sidebar-scroll">{children}</div>
    </nav>
  );
}

export interface CatalystSidebarGroupProps extends Omit<ComponentProps<"div">, "title"> {
  /** The group's header (“Following”). It names the group. */
  title: ReactNode;
}

/** A titled group of rows in a `CatalystSidebar`. */
export function CatalystSidebarGroup({
  title,
  className,
  children,
  ...props
}: CatalystSidebarGroupProps) {
  const id = useId();
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring form semantics to a list of destinations
    <div
      role="group"
      aria-labelledby={id}
      {...props}
      className={cn("mac-catalyst-chrome-sidebar-group", className)}
    >
      <div id={id} className="mac-catalyst-chrome-sidebar-header">
        {title}
      </div>
      {children}
    </div>
  );
}

export interface CatalystSidebarItemProps extends useRender.ComponentProps<"button"> {
  /** An 18.5 pt image before the label: an app-icon shaped drawing. Decorative. */
  icon?: ReactNode;
  /**
   * Marks the row as the destination being shown: the grey selection, and `aria-current`.
   * @default false
   */
  selected?: boolean;
}

/** A `<button>` without a type would submit a form it stands in: give it the row's, or "button". */
function plainButton(element: ReactElement, type: string = "button"): ReactElement {
  const props = element.props as { type?: string };
  return element.type === "button" && props.type === undefined
    ? cloneElement(element as ReactElement<{ type?: string }>, { type })
    : element;
}

/**
 * A row of a `CatalystSidebar`: a button with an icon and a label, 26 pt apart. Pass
 * `render={<a href="…" />}` for a link. A button, rendered or not, is `type="button"` unless
 * it says otherwise, so a row never submits a form.
 */
export function CatalystSidebarItem({
  icon,
  selected = false,
  className,
  children,
  render,
  ref,
  ...props
}: CatalystSidebarItemProps) {
  type Render = NonNullable<typeof render>;
  const rendered =
    typeof render === "function"
      ? (((...args: Parameters<Extract<Render, (...args: never[]) => unknown>>) =>
          plainButton(render(...args), props.type)) as Render)
      : render && plainButton(render, props.type);
  return useRender({
    defaultTagName: "button",
    render: rendered,
    ref,
    props: {
      type: render ? undefined : "button",
      "aria-current": selected ? "page" : undefined,
      ...props,
      className: cn("mac-catalyst-chrome-sidebar-item", className),
      children: (
        <>
          {icon == null || icon === false ? null : (
            <span className="mac-catalyst-chrome-sidebar-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <span className="mac-catalyst-chrome-sidebar-label">{children}</span>
        </>
      ),
    },
  });
}
