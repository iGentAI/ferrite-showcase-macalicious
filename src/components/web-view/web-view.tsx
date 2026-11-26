"use client";

import { Progress as BaseProgress } from "@base-ui/react/progress";
import { useRender } from "@base-ui/react/use-render";
import {
  type ComponentProps,
  type CSSProperties,
  type HTMLAttributeReferrerPolicy,
  type ReactNode,
  type Ref,
  useId,
} from "react";
import { cn, withClassName } from "../../lib/cn";
import { whenEnabled } from "./web-view-tab-overview";
import "./web-view.tokens.css";
import "./web-view.css";

/** The children are the page: no `src`, and `title`, when given, names the view. */
type Unframed = { src?: undefined; title?: string };
/** A framed document: `src`, with the `title` that names the frame. */
type Framed = { src: string; title: string };

export type WebViewProps = {
  /**
   * The canvas behind the content. `"page"` is a web page's default background; `"start"` is
   * Safari's start page, behind `WebViewFavorites`; `"overview"` is the Tab Overview canvas,
   * behind `WebViewTabOverview`; `"reader"` is the grey canvas around a `WebViewReader` sheet.
   * @default "page"
   */
  surface?: "page" | "start" | "overview" | "reader";
  /**
   * Address of a page to show in a sandboxed `<iframe>` that fills the view. Without it the
   * children are the page. A site that forbids framing stays blank: the view has no browsing
   * engine of its own.
   */
  src?: string;
  /**
   * Accessible name. Required with `src`, where it is the frame's `title`. Without `src` it
   * names the view, which then becomes a `region`.
   */
  title?: string;
  /**
   * The frame's `sandbox` tokens. The default runs the page's scripts in an origin of its own
   * and lets it submit forms; it cannot read the embedding page, open windows or navigate the
   * top frame. Pass `""` for a page that must not run scripts.
   * @default "allow-scripts allow-forms"
   */
  sandbox?: string;
  /**
   * The frame's referrer policy.
   * @default "no-referrer"
   */
  referrerPolicy?: HTMLAttributeReferrerPolicy;
  /** Other attributes of the `<iframe>`: `ref`, `allow`, `loading`, `name`, `onLoad`. */
  frameProps?: Omit<ComponentProps<"iframe">, "src" | "title" | "sandbox" | "referrerPolicy">;
} & Omit<ComponentProps<"div">, "title"> &
  (Unframed | Framed);

/**
 * A web view (WKWebView): the content area of a browser window. It frames content that is
 * supplied to it and has no browsing engine: the children are the page, or `src` names a
 * document for a sandboxed `<iframe>`.
 *
 * Renders a `<div>` that scrolls its children with native overflow and can take keyboard
 * focus, so the page scrolls from the keyboard. Give it a height. With `src` the frame
 * scrolls instead, and children are drawn over it (a `WebViewProgress`).
 */
export function WebView({
  surface = "page",
  src,
  title,
  sandbox = "allow-scripts allow-forms",
  referrerPolicy = "no-referrer",
  frameProps,
  className,
  children,
  ...props
}: WebViewProps) {
  const framed = src !== undefined;
  return (
    <div
      tabIndex={framed ? undefined : 0}
      {...(!framed && title ? { role: "region", "aria-label": title } : null)}
      data-surface={surface}
      data-frame={framed ? "" : undefined}
      className={cn("mac-web-view", className)}
      {...props}
    >
      {children}
      {framed ? (
        <iframe
          {...frameProps}
          src={src}
          title={title}
          sandbox={sandbox}
          referrerPolicy={referrerPolicy}
          className={cn("mac-web-view-frame", frameProps?.className)}
        />
      ) : null}
    </div>
  );
}

export interface WebViewProgressProps extends Omit<BaseProgress.Root.Props, "ref" | "children"> {
  /** Ref to the rendered element, the one with `role="progressbar"`. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The loading line: a 2 pt bar in the accent colour along the top edge of a `WebView`, as
 * wide as the share of the page that has loaded. Built on Base UI's Progress: `value` runs
 * from `min` (0) to `max` (100), and `null` shows a short bar for a load of unknown length.
 * Name it with `aria-label`; remove it when the page has loaded.
 */
export function WebViewProgress({ className, ...props }: WebViewProgressProps) {
  return (
    <BaseProgress.Root className={withClassName("mac-web-view-progress", className)} {...props}>
      <BaseProgress.Indicator className="mac-web-view-progress-indicator" />
    </BaseProgress.Root>
  );
}

export interface WebViewFavoritesProps extends ComponentProps<"section"> {
  /** The heading above the grid ("Favorites"). It is an `<h2>` and names the section. */
  heading?: ReactNode;
  /**
   * Number of tiles in a row. The grid has a fixed width, 115 pt per column, and is centred
   * in the view.
   * @default 6
   */
  columns?: number;
}

/**
 * The Favorites grid of Safari's start page: a heading and rows of `WebViewFavorite` tiles.
 * Put it in a `WebView` with `surface="start"`. Renders a `<section>`.
 */
export function WebViewFavorites({
  heading,
  columns = 6,
  className,
  style,
  children,
  ...props
}: WebViewFavoritesProps) {
  const headingId = useId();
  const hasHeading = heading != null && heading !== false;
  return (
    <section
      aria-labelledby={hasHeading ? headingId : undefined}
      className={cn("mac-web-view-favorites", className)}
      style={{ "--mac-web-view-columns": columns, ...style } as CSSProperties}
      {...props}
    >
      {hasHeading && (
        <h2 id={headingId} className="mac-web-view-heading">
          {heading}
        </h2>
      )}
      <div className="mac-web-view-favorites-grid">{children}</div>
    </section>
  );
}

export interface WebViewFavoriteProps extends useRender.ComponentProps<"a"> {
  /** The title under the tile. It names the link. */
  label: ReactNode;
  /** A second, muted line under the title, such as the number of pages in a folder. */
  detail?: ReactNode;
}

/**
 * One favourite: an 80 pt tile with its title under it. The children are the tile's content
 * (a letter, a drawing or an image of your own) and are hidden from assistive technology,
 * which reads the `label`. Renders an `<a>`; Base UI's `render` prop renders another element,
 * such as a `<button>` for a folder. With `aria-disabled="true"`, or as a disabled button, it
 * ignores a click and the link is not followed.
 */
export function WebViewFavorite({
  label,
  detail,
  className,
  render,
  ref,
  children,
  ...props
}: WebViewFavoriteProps) {
  return useRender({
    defaultTagName: "a",
    render,
    ref,
    props: {
      ...props,
      onClickCapture: whenEnabled(props.onClickCapture),
      className: cn("mac-web-view-favorite", className),
      children: (
        <>
          <span className="mac-web-view-tile" aria-hidden="true">
            {children}
          </span>
          <span className="mac-web-view-favorite-label">{label}</span>
          {/* A space for the accessible name; a flex container does not render it. */}
          {detail != null && " "}
          {detail != null && <span className="mac-web-view-favorite-detail">{detail}</span>}
        </>
      ),
    },
  });
}

export interface WebViewReaderProps extends ComponentProps<"article"> {}

/**
 * The Reader sheet: a centred column of paper, 786 pt wide at most, with Reader's text
 * setting. Put it in a `WebView` with `surface="reader"`. Renders an `<article>`.
 */
export function WebViewReader({ className, ...props }: WebViewReaderProps) {
  return <article className={cn("mac-web-view-reader", className)} {...props} />;
}

export interface WebViewReaderTitleProps extends ComponentProps<"h1"> {}

/** The article's title on a `WebViewReader` sheet, 36 pt bold. Renders an `<h1>`. */
export function WebViewReaderTitle({ className, children, ...props }: WebViewReaderTitleProps) {
  return (
    <h1 className={cn("mac-web-view-reader-title", className)} {...props}>
      {children}
    </h1>
  );
}

export interface WebViewErrorProps extends Omit<ComponentProps<"div">, "title"> {
  /** The headline: what went wrong, in a few words. It is an `<h2>`. */
  title: ReactNode;
}

/**
 * The page a web view shows when it cannot open a page: a centred headline with the
 * explanation, the children, under it. It fills the `WebView` it is in. Renders a `<div>`.
 */
export function WebViewError({ title, className, children, ...props }: WebViewErrorProps) {
  return (
    <div className={cn("mac-web-view-error", className)} {...props}>
      <h2 className="mac-web-view-error-title">{title}</h2>
      {children != null && <div className="mac-web-view-error-message">{children}</div>}
    </div>
  );
}
