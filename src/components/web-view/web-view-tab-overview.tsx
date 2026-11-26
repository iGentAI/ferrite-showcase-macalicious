"use client";

import { useRender } from "@base-ui/react/use-render";
import type { ComponentProps, CSSProperties, MouseEvent, ReactNode } from "react";
import { cn } from "../../lib/cn";
import "./web-view.tokens.css";
import "./web-view.css";

/**
 * The capture-phase click handler of a tile that may be rendered as any element: while the
 * element is disabled (`disabled`, or `aria-disabled="true"` where there is no such
 * attribute, as on a link), a click does nothing; a link is not followed.
 */
export function whenEnabled<E extends HTMLElement>(next?: (event: MouseEvent<E>) => void) {
  return (event: MouseEvent<E>) => {
    if (event.currentTarget.matches(":disabled, [aria-disabled='true']")) {
      event.preventDefault();
      event.stopPropagation();
    } else next?.(event);
  };
}

export interface WebViewTabOverviewProps extends ComponentProps<"div"> {
  /**
   * Number of thumbnails in a row. They share the width of the view, as in Safari, where four
   * tiles fill a window.
   * @default 4
   */
  columns?: number;
}

/**
 * The Tab Overview grid: `WebViewTabThumbnail`s, 18 pt apart. Put it in a `WebView` with
 * `surface="overview"`. Renders a `<div>`; name it with `aria-label` and it is a `group`.
 */
export function WebViewTabOverview({
  columns = 4,
  className,
  style,
  ...props
}: WebViewTabOverviewProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset
    <div
      role="group"
      className={cn("mac-web-view-tab-overview", className)}
      style={{ "--mac-web-view-columns": columns, ...style } as CSSProperties}
      {...props}
    />
  );
}

export interface WebViewTabThumbnailProps
  extends Omit<useRender.ComponentProps<"button">, "title"> {
  /** The page's title, centred in the band above the miniature. It names the button. */
  title?: ReactNode;
  /**
   * `"page"` is an open tab: a title band over a miniature of the page, the children.
   * `"new-tab"` is the grey tile with a large + that opens a tab; it has no title, so give it
   * an `aria-label`.
   * @default "page"
   */
  variant?: "page" | "new-tab";
}

/**
 * One tile of the Tab Overview. The children are the miniature of the page: a picture of
 * your own, clipped to the tile and hidden from assistive technology. Renders a `<button>`;
 * Base UI's `render` prop renders another element. `disabled` holds on any element: a tile
 * rendered as a link gets `aria-disabled` and ignores a click.
 */
export function WebViewTabThumbnail({
  title,
  variant = "page",
  className,
  render,
  ref,
  children,
  ...props
}: WebViewTabThumbnailProps) {
  return useRender({
    defaultTagName: "button",
    render,
    ref,
    props: {
      type: "button",
      "data-variant": variant,
      "aria-disabled": props.disabled || undefined,
      ...props,
      onClickCapture: whenEnabled(props.onClickCapture),
      className: cn("mac-web-view-thumbnail", className),
      children:
        variant === "page" ? (
          <>
            <span className="mac-web-view-thumbnail-title">{title}</span>
            <span className="mac-web-view-thumbnail-page" aria-hidden="true">
              {children}
            </span>
          </>
        ) : null,
    },
  });
}
