"use client";

import { useRender } from "@base-ui/react/use-render";
import { type KeyboardEvent, type MouseEventHandler, type ReactNode, useId } from "react";
import { cn } from "../../lib/cn";
import "./stock-row.tokens.css";
import "./stock-row.css";

/** The sparkline's box in points, and the half line width kept clear above and below. */
const WIDTH = 54.67;
const HEIGHT = 26;
const INSET = 0.75;

export interface StockListProps extends useRender.ComponentProps<"div"> {
  /** The rows: one `StockRow` per ticker. */
  children?: ReactNode;
}

/**
 * The watchlist of Stocks: a list of `StockRow`s separated by inset hairlines.
 *
 * Renders a `<div role="list">`; name it with `aria-label` ("Watchlist"). Rows that can be
 * chosen are buttons in the tab order, and the Up, Down, Home and End keys move the focus
 * from one row to another. Base UI's `render` prop renders another element.
 *
 * The list and its rows are `<div>`s with the list roles, not `<ul>` and `<li>`, so that a
 * page's own list styles do not reach into the rows.
 */
export function StockList({ className, render, ref, onKeyDown, ...props }: StockListProps) {
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "list",
      ...props,
      className: cn("mac-stock-row-list", className),
      onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        onKeyDown?.(event);
        const from = event.target as HTMLElement;
        if (event.defaultPrevented || !from.matches("button.mac-stock-row-main")) return;
        const rows = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>("button.mac-stock-row-main"),
        );
        const at = rows.indexOf(from);
        const to = (
          { ArrowUp: at - 1, ArrowDown: at + 1, Home: 0, End: rows.length - 1 } as Record<
            string,
            number | undefined
          >
        )[event.key];
        if (to === undefined) return;
        event.preventDefault();
        rows[to]?.focus();
      },
    },
  });
}

export interface StockRowProps
  extends Omit<useRender.ComponentProps<"div">, "children" | "onSelect"> {
  /** The ticker symbol or the index's short name, on the first line: "AAPL", "Dow Jones". */
  symbol: ReactNode;
  /** The company's or index's full name, on the second line. Cut with an ellipsis if too long. */
  name: ReactNode;
  /** The last price, already formatted: "26,201.04". */
  price: string;
  /**
   * The text of the badge, already formatted and with its sign: the change in price
   * ("+122.42"), in percent ("+0.47%") or the market capitalisation.
   */
  change: string;
  /**
   * Whether the ticker is up or down on the previous close: a green or a red badge and
   * sparkline. `"none"` is a ticker without a quote, or one that has not moved: both are grey.
   */
  direction: "gain" | "loss" | "none";
  /**
   * The session's prices in order, for the sparkline. They are spaced evenly from the left
   * edge. Without at least two, no sparkline is drawn.
   */
  data?: readonly number[];
  /** The previous close, drawn as a dashed line across the whole sparkline. */
  previousClose?: number;
  /**
   * The lowest and highest price the sparkline's height spans. By default the lowest and
   * highest of `data`, extended to include `previousClose`.
   */
  domain?: readonly [low: number, high: number];
  /**
   * How much of the session has passed, from 0 to 1: the share of the sparkline's width the
   * prices span. The previous close always spans the full width.
   * @default 1
   */
  progress?: number;
  /**
   * Marks the row whose ticker is shown beside the list: a lighter row, and `aria-current`
   * for assistive technology.
   * @default false
   */
  selected?: boolean;
  /**
   * Called when the row is chosen. With it the symbol, name, sparkline and price are one
   * `<button>`; without it the row is plain text.
   */
  onSelect?: MouseEventHandler<HTMLButtonElement>;
  /**
   * Called when the badge is clicked, which in Stocks cycles what it shows. With it the badge
   * is a `<button>` of its own; without it the badge is plain text.
   */
  onBadgeClick?: MouseEventHandler<HTMLButtonElement>;
  /**
   * Accessible name of the badge when it is a button, saying what a click does: "Change
   * +122.42, show percent change". By default its text.
   */
  badgeLabel?: string;
  /**
   * Accessible name of the sparkline, describing the trend.
   * @default "Trending up" for a gain, "Trending down" for a loss, "No change" for none
   */
  chartLabel?: string;
}

/**
 * One ticker of the Stocks watchlist: symbol over name, the session's sparkline, and the
 * price over a coloured change badge.
 *
 * It is a Mac Catalyst table cell, which AppKit has no class for, and Base UI has no
 * primitive: the row is a list item (`<div role="listitem">`) for a `StockList`, the
 * sparkline an inline SVG with `role="img"`. Props and `ref` go to the row; Base UI's
 * `render` prop renders another element.
 */
export function StockRow({
  symbol,
  name,
  price,
  change,
  direction,
  data,
  previousClose,
  domain,
  progress = 1,
  selected = false,
  onSelect,
  onBadgeClick,
  badgeLabel,
  chartLabel = { gain: "Trending up", loss: "Trending down", none: "No change" }[direction],
  className,
  render,
  ref,
  ...props
}: StockRowProps) {
  const gradient = useId();
  let chart: ReactNode = null;
  if (data && data.length > 1) {
    const all = previousClose === undefined ? data : [...data, previousClose];
    // Not Math.min(...all): a long session would exceed the engine's limit on arguments.
    const [low, high] = domain ?? [
      all.reduce((a, b) => Math.min(a, b)),
      all.reduce((a, b) => Math.max(a, b)),
    ];
    // A price to its height in the box; a flat session sits in the middle.
    const y = (value: number) =>
      high > low
        ? +(INSET + ((high - value) / (high - low)) * (HEIGHT - 2 * INSET)).toFixed(2)
        : HEIGHT / 2;
    const step = (WIDTH * Math.min(Math.max(progress, 0), 1)) / (data.length - 1);
    const line = data.map((value, index) => `${+(index * step).toFixed(2)},${y(value)}`).join(" ");
    const end = +((data.length - 1) * step).toFixed(2);
    chart = (
      <svg
        className="mac-stock-row-sparkline"
        role="img"
        aria-label={chartLabel}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <linearGradient
          id={gradient}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2={HEIGHT}
        >
          <stop className="mac-stock-row-sparkline-fill-top" offset="0" />
          <stop className="mac-stock-row-sparkline-fill-bottom" offset="1" />
        </linearGradient>
        <polygon fill={`url(#${gradient})`} points={`0,${HEIGHT} ${line} ${end},${HEIGHT}`} />
        {previousClose === undefined ? null : (
          <line
            className="mac-stock-row-sparkline-close"
            x2={WIDTH}
            y1={y(previousClose)}
            y2={y(previousClose)}
          />
        )}
        <polyline className="mac-stock-row-sparkline-line" points={line} />
      </svg>
    );
  }
  const main = (
    <>
      <span className="mac-stock-row-symbol">{symbol}</span>{" "}
      <span className="mac-stock-row-name">{name}</span> {chart}{" "}
      <span className="mac-stock-row-price">{price}</span>{" "}
      {onBadgeClick ? null : <span className="mac-stock-row-badge">{change}</span>}
    </>
  );
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "listitem",
      "data-direction": direction,
      "data-selected": selected ? "" : undefined,
      "aria-current": selected && !onSelect ? true : undefined,
      ...props,
      className: cn("mac-stock-row", className),
      children: (
        <>
          {onSelect ? (
            <button
              type="button"
              className="mac-stock-row-main"
              aria-current={selected || undefined}
              onClick={onSelect}
            >
              {main}
            </button>
          ) : (
            <div className="mac-stock-row-main">{main}</div>
          )}
          {onBadgeClick ? (
            <button
              type="button"
              className="mac-stock-row-badge"
              aria-label={badgeLabel}
              onClick={onBadgeClick}
            >
              {change}
            </button>
          ) : null}
        </>
      ),
    },
  });
}
