"use client";

import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "../../lib/cn";
import "./today-widget.tokens.css";
import "./today-widget.css";

export interface TodayWidgetProps extends Omit<ComponentProps<"section">, "title"> {
  /**
   * Name of the widget, shown in upper case in the 26 pt header band; it also names the card
   * for assistive technology. Leave it out for a system card without a header, such as the
   * card of switches at the top of the Today view, and give that one an `aria-label`.
   */
  title?: ReactNode;
  /** The app's icon, drawn in a 14 pt box before the title. Decorative: hidden from assistive technology. */
  icon?: ReactNode;
}

/**
 * A card of Notification Center's Today view (an `NCWidgetProviding` extension's host): a
 * translucent rounded card, 322 pt wide, with a header band that names the app and content the
 * widget draws itself.
 *
 * The root is a `<section>` named by the title; `className`, `style`, `ref` and other
 * attributes go to it. The card has no blur of its own: it is an overlay on the material of
 * the `NotificationCenter` behind it.
 */
export function TodayWidget({ title, icon, className, children, ...props }: TodayWidgetProps) {
  const titleId = useId();
  const titled = title != null && title !== false;
  return (
    <section
      aria-labelledby={titled ? titleId : undefined}
      className={cn("mac-today-widget", className)}
      {...props}
    >
      {titled && (
        <div className="mac-today-widget-header">
          {icon != null && (
            <span className="mac-today-widget-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <span id={titleId} className="mac-today-widget-title">
            {title}
          </span>
        </div>
      )}
      <div className="mac-today-widget-content">{children}</div>
    </section>
  );
}

export interface TodayWidgetRowProps extends Omit<ComponentProps<"label">, "children"> {
  /** Title of the row, shown in upper case. It names the control the row holds. */
  label: ReactNode;
  /** A glyph drawn in a 16 pt box before the label. Decorative. */
  icon?: ReactNode;
  /** The control at the trailing edge, normally a `Switch`. */
  children?: ReactNode;
}

/**
 * A 42.5 pt row of a system card: a glyph, a label in upper case and a control at the trailing
 * edge, as the Night Shift and Do Not Disturb rows. Rows are divided by a line that starts at
 * the label.
 *
 * The row is a `<label>`, so the label names the control and a click anywhere on the row
 * operates it.
 */
export function TodayWidgetRow({
  label,
  icon,
  className,
  children,
  ...props
}: TodayWidgetRowProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the row's child
    <label className={cn("mac-today-widget-row", className)} {...props}>
      <span className="mac-today-widget-row-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mac-today-widget-row-label">{label}</span>
      {children}
    </label>
  );
}

export interface TodayWidgetDateProps extends Omit<ComponentProps<"div">, "children"> {
  /** First line: the day of the week, as "Thursday,". */
  weekday: ReactNode;
  /** Second line: the month and the day, as "October 3". */
  date: ReactNode;
}

/** The date block of the Today view: two lines of large thin text, set straight on the panel. */
export function TodayWidgetDate({ weekday, date, className, ...props }: TodayWidgetDateProps) {
  return (
    <div className={cn("mac-today-widget-date", className)} {...props}>
      <span>{weekday}</span>
      <span>{date}</span>
    </div>
  );
}

export interface TodayWidgetSummaryProps extends ComponentProps<"div"> {
  /** A glyph beside the first paragraph, such as the weather. Decorative. */
  icon?: ReactNode;
}

/**
 * The summary under the date: paragraphs of 12 pt text set straight on the panel. Pass each
 * paragraph as a `<p>`.
 */
export function TodayWidgetSummary({
  icon,
  className,
  children,
  ...props
}: TodayWidgetSummaryProps) {
  return (
    <div className={cn("mac-today-widget-summary", className)} {...props}>
      {icon != null && (
        <span className="mac-today-widget-summary-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </div>
  );
}
