"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps, MouseEventHandler, ReactNode } from "react";
import { cn } from "../../lib/cn";
import "./shelf-pager.tokens.css";
import "./shelf-pager.css";

export interface ShelfPagerProps extends ComponentProps<"div"> {
  /** What the chevrons page: a shelf of cards or a hero, with its own side margins. */
  children?: ReactNode;
  /** Called when the chevron at the leading edge is activated: show the previous page. */
  onPrevious?: MouseEventHandler<HTMLElement>;
  /** Called when the chevron at the trailing edge is activated: show the next page. */
  onNext?: MouseEventHandler<HTMLElement>;
  /**
   * Dims the leading chevron and makes it inert: there is nothing before the first page. It
   * stays in the tab order, so the focus is not lost when a page turn disables it.
   * @default false
   */
  previousDisabled?: boolean;
  /**
   * Dims the trailing chevron and makes it inert: there is nothing after the last page.
   * @default false
   */
  nextDisabled?: boolean;
  /**
   * Accessible name of the leading chevron.
   * @default "Previous"
   */
  previousLabel?: string;
  /**
   * Accessible name of the trailing chevron.
   * @default "Next"
   */
  nextLabel?: string;
}

/** `"previous"` shows "<" left to right and ">" right to left; `"next"` the reverse. */
const PATHS = {
  previous: "M13.41-1 .66 14.5 13.41 30M12.59-1 25.34 14.5 12.59 30",
  next: "M-.41-1 12.34 14.5-.41 30M26.41-1 13.66 14.5 26.41 30",
};

/**
 * The paging chevrons of a store shelf (TV, Podcasts, App Store): two thin angle brackets in
 * the side margins, level with the middle of what they page. A chevron is dimmed when there
 * is nothing further in its direction.
 *
 * Renders a `<div>` around its children with a Base UI `Button` before and after them. It
 * does not scroll anything itself: turn the page in `onPrevious` and `onNext` (a `CardGrid`
 * shelf scrolls with `scrollBy` on its list) and say with `previousDisabled` and
 * `nextDisabled` where the ends are. Other props and `ref` go to the `<div>`.
 */
export function ShelfPager({
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  previousLabel = "Previous",
  nextLabel = "Next",
  className,
  children,
  ...props
}: ShelfPagerProps) {
  const chevron = (
    direction: "previous" | "next",
    label: string,
    disabled: boolean,
    onClick?: MouseEventHandler<HTMLElement>,
  ) => (
    <BaseButton
      className="mac-shelf-pager-chevron"
      data-direction={direction}
      aria-label={label}
      disabled={disabled}
      focusableWhenDisabled
      onClick={onClick}
    >
      <svg viewBox="0 0 26 29" aria-hidden="true">
        <path d={PATHS[direction]} />
      </svg>
    </BaseButton>
  );
  return (
    <div {...props} className={cn("mac-shelf-pager", className)}>
      {chevron("previous", previousLabel, previousDisabled, onPrevious)}
      {children}
      {chevron("next", nextLabel, nextDisabled, onNext)}
    </div>
  );
}
