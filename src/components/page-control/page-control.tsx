"use client";

import { type ComponentProps, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import "./page-control.tokens.css";
import "./page-control.css";

export interface PageControlProps extends Omit<ComponentProps<"div">, "children"> {
  /**
   * `"pager"` is Photo Booth's effects pager: opaque 12 pt dots, the current one blue, between
   * a previous and a next arrow. `"overlay"` is Launchpad's: translucent white 8 pt dots for
   * use over a picture or a dark, blurred backdrop, without arrows.
   * @default "pager"
   */
  variant?: "pager" | "overlay";
  /**
   * Number of pages. One dot is drawn for each. With more than 100 pages the row shows 100
   * dots at a time, the block of a hundred pages that holds the current one (pages 1 to 100,
   * 101 to 200 and so on); the arrows and the arrow keys still reach
   * every page. A fraction is rounded down, and a number that is negative or not finite counts
   * as 0.
   */
  count: number;
  /** Index of the current page, from 0. Use with `onPageChange` for controlled use. */
  page?: number;
  /**
   * Index of the page that is current at first, when uncontrolled.
   * @default 0
   */
  defaultPage?: number;
  /** Called with the new page index when a dot, an arrow or an arrow key changes the page. */
  onPageChange?: (page: number) => void;
  /**
   * Whether the previous and next arrows are shown. Pages do not wrap: an arrow is disabled on
   * the first or last page.
   * @default true for "pager", false for "overlay"
   */
  arrows?: boolean;
  /**
   * Disables every dot and arrow.
   * @default false
   */
  disabled?: boolean;
  /**
   * Accessible name of a dot.
   * @default (page, count) => `Page ${page + 1} of ${count}`
   */
  getPageLabel?: (page: number, count: number) => string;
  /**
   * Accessible name of the previous arrow.
   * @default "Previous page"
   */
  previousLabel?: string;
  /**
   * Accessible name of the next arrow.
   * @default "Next page"
   */
  nextLabel?: string;
}

const defaultPageLabel = (page: number, count: number) => `Page ${page + 1} of ${count}`;

/** The most dots one control draws at a time: a longer row cannot be read or hit. */
const MAX_DOTS = 100;

/** A whole number from 0 to `last`; anything that is not a finite number becomes 0. */
const toIndex = (value: number, last: number) =>
  Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 0), last) : 0;

/**
 * Page indicator dots: one dot per page, the current one emphasised. Clicking a dot goes to
 * its page; the pager variant adds previous and next arrows.
 *
 * macOS 10.15 has no standard control for this; the two variants reproduce the app-drawn
 * pagers of Photo Booth and Launchpad. The root is a `group`: give it an `aria-label`.
 */
export function PageControl({
  variant = "pager",
  count: countProp,
  page: pageProp,
  defaultPage = 0,
  onPageChange,
  arrows = variant === "pager",
  disabled = false,
  getPageLabel = defaultPageLabel,
  previousLabel = "Previous page",
  nextLabel = "Next page",
  className,
  ...props
}: PageControlProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultPage);
  const count = toIndex(countProp, Number.MAX_SAFE_INTEGER);
  const last = Math.max(0, count - 1);
  const page = toIndex(pageProp ?? uncontrolled, last);
  // The dots drawn: all of them, or the hundred that hold the current page.
  const shown = Math.min(count, MAX_DOTS);
  const first = Math.min(Math.floor(page / MAX_DOTS) * MAX_DOTS, count - shown);

  // A key that goes to a page whose dot is not drawn yet: its dot takes focus once it is.
  const dotsRef = useRef<HTMLSpanElement>(null);
  const focusPage = useRef<number | null>(null);
  useEffect(() => {
    if (focusPage.current === page) {
      dotsRef.current?.querySelector<HTMLElement>("[data-current]")?.focus();
    }
    focusPage.current = null;
  }, [page]);

  const goTo = (next: number) => {
    const clamped = toIndex(next, last);
    if (disabled || clamped === page) return false;
    if (pageProp === undefined) setUncontrolled(clamped);
    onPageChange?.(clamped);
    return true;
  };

  // Arrow keys move between the dots, as in a tab list or radio group: one tab stop for the
  // row, and focus follows the current page.
  const onDotsKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    let next: number;
    if (event.key === "ArrowRight") next = page + (rtl ? -1 : 1);
    else if (event.key === "ArrowLeft") next = page + (rtl ? 1 : -1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    const clamped = Math.min(Math.max(next, 0), last);
    const dot = event.currentTarget.children[clamped - first] as HTMLElement | undefined;
    if (!dot) focusPage.current = clamped;
    goTo(clamped);
    dot?.focus();
  };

  const dots = [];
  for (let index = first; index < first + shown; index++) {
    const current = index === page;
    dots.push(
      <button
        key={index}
        type="button"
        className="mac-page-control-dot"
        aria-label={getPageLabel(index, count)}
        aria-current={current ? "page" : undefined}
        data-current={current ? "" : undefined}
        tabIndex={current ? 0 : -1}
        disabled={disabled}
        onClick={() => goTo(index)}
      />,
    );
  }

  const arrow = (direction: "previous" | "next") => {
    const atEnd = direction === "previous" ? page === 0 : page === last;
    return (
      <button
        type="button"
        className="mac-page-control-arrow"
        data-direction={direction}
        aria-label={direction === "previous" ? previousLabel : nextLabel}
        // Not the disabled attribute at the ends: the arrow that just took the pager to its
        // last page must keep keyboard focus.
        aria-disabled={atEnd || disabled ? true : undefined}
        disabled={disabled}
        onClick={() => goTo(direction === "previous" ? page - 1 : page + 1)}
      >
        <svg
          className="mac-page-control-arrow-glyph"
          viewBox="0 0 16 20"
          aria-hidden="true"
          focusable="false"
        >
          <path d={direction === "previous" ? "M16 0 0 10l16 10z" : "M0 0l16 10L0 20z"} />
        </svg>
      </button>
    );
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset
    <div
      role="group"
      data-variant={variant}
      data-disabled={disabled ? "" : undefined}
      className={cn("mac-page-control", className)}
      {...props}
    >
      {arrows && arrow("previous")}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: handles arrow keys that bubble up from the dot buttons inside it */}
      <span ref={dotsRef} className="mac-page-control-dots" onKeyDown={onDotsKeyDown}>
        {dots}
      </span>
      {arrows && arrow("next")}
    </div>
  );
}
