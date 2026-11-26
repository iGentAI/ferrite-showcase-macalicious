"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { type ComponentProps, type ReactNode, type Ref, useId, useState } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./notification-center.tokens.css";
import "./notification-center.css";

export interface NotificationCenterProps
  extends Omit<BaseTabs.Root.Props, "ref" | "orientation" | "value" | "defaultValue"> {
  /** The view shown, controlled. */
  value?: "today" | "notifications";
  /**
   * The view shown at first, when the panel keeps its own state.
   * @default "today"
   */
  defaultValue?: "today" | "notifications";
  /**
   * Whether the panel is on screen. A closed panel is moved out past its trailing edge, is
   * hidden from assistive technology and takes no input.
   * @default true
   */
  open?: boolean;
  /**
   * Title of the first segment.
   * @default "Today"
   */
  todayLabel?: ReactNode;
  /**
   * Title of the second segment.
   * @default "Notifications"
   */
  notificationsLabel?: ReactNode;
  /**
   * Title of the footer button of the Today view: "Edit", or "2 New" when new widgets are
   * available. Without it the footer has no button.
   */
  editLabel?: ReactNode;
  /** Called by the footer button of the Today view. */
  onEdit?: () => void;
  /** Called by the gear button of the footer. Without it the footer has no gear. */
  onSettings?: () => void;
  /**
   * Accessible name of the gear button.
   * @default "Notification Center Preferences"
   */
  settingsLabel?: string;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * Notification Center: the panel on the trailing edge of the screen, 344 pt wide, with a Today
 * view and a Notifications view chosen by the two segments of its header.
 *
 * Built on Base UI's Tabs, so it accepts `value`, `defaultValue` and `onValueChange`, and the
 * arrow keys move between the segments. The root is an `<aside>` named "Notification Center"
 * (override with `aria-label`). Compose it from two `NotificationCenterView`s. The panel fills
 * the height of its container; place it under the menu bar, over the desktop, in the same page
 * as what it should blur.
 */
export function NotificationCenter({
  value,
  defaultValue = "today",
  open = true,
  todayLabel = "Today",
  notificationsLabel = "Notifications",
  editLabel,
  onEdit,
  onSettings,
  settingsLabel = "Notification Center Preferences",
  onValueChange,
  className,
  children,
  "aria-label": ariaLabel = "Notification Center",
  ref,
  ...props
}: NotificationCenterProps) {
  // The footer button belongs to the Today view, so the panel has to know the view shown.
  const [own, setOwn] = useState(defaultValue);
  const current = value ?? own;
  return (
    <BaseTabs.Root
      render={<aside />}
      // Base UI types the root as a div; it is rendered as the aside.
      ref={ref as Ref<HTMLDivElement>}
      aria-label={ariaLabel}
      data-open={open ? "" : undefined}
      inert={!open}
      className={withClassName("mac-notification-center", className)}
      value={current}
      onValueChange={(next, details) => {
        onValueChange?.(next, details);
        if (!details.isCanceled) setOwn(next);
      }}
      {...props}
    >
      <BaseTabs.List className="mac-notification-center-header">
        <BaseTabs.Tab value="today" className="mac-notification-center-segment">
          {todayLabel}
        </BaseTabs.Tab>
        <BaseTabs.Tab value="notifications" className="mac-notification-center-segment">
          {notificationsLabel}
        </BaseTabs.Tab>
      </BaseTabs.List>
      {children}
      <div className="mac-notification-center-footer">
        {current === "today" && editLabel != null && (
          <BaseButton className="mac-notification-center-edit" onClick={onEdit}>
            {editLabel}
          </BaseButton>
        )}
        {onSettings && (
          <BaseButton
            aria-label={settingsLabel}
            className="mac-notification-center-settings"
            onClick={onSettings}
          >
            {/* A gear: a ring with teeth, drawn as a dashed stroke, and three spokes. */}
            <svg viewBox="0 0 18 18" aria-hidden="true">
              <circle cx="9" cy="9" r="8.3" strokeWidth="1.4" strokeDasharray="2.2 1.06" />
              <circle cx="9" cy="9" r="6.85" strokeWidth="1.8" />
              <path d="M9 9h6.5M9 9 5.75 14.63M9 9 5.75 3.37" strokeWidth="2.5" />
            </svg>
          </BaseButton>
        )}
      </div>
    </BaseTabs.Root>
  );
}

export interface NotificationCenterViewProps extends Omit<BaseTabs.Panel.Props, "ref" | "value"> {
  /** Which view this is: it is shown while the segment of the same value is selected. */
  value: "today" | "notifications";
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * One of the two views: the scrolling area between the header and the footer, which stacks
 * its children (`TodayWidget`s, `NotificationCenterGroup`s) 6 pt apart with 11 pt margins.
 * Renders Base UI's Tabs.Panel; a hidden view is not in the DOM unless `keepMounted` is set.
 */
export function NotificationCenterView({ className, ...props }: NotificationCenterViewProps) {
  return (
    <BaseTabs.Panel
      className={withClassName("mac-notification-center-view", className)}
      {...props}
    />
  );
}

export interface NotificationCenterGroupProps extends ComponentProps<"section"> {
  /** The day the notifications were delivered: "Today", "Yesterday", a date. */
  heading: ReactNode;
  /** Called by the clear button beside the heading. Without it the group has no clear button. */
  onClear?: () => void;
  /**
   * Accessible name of the clear button.
   * @default "Clear"
   */
  clearLabel?: string;
}

/**
 * The notifications of one day in the Notifications view: a large light heading with a clear
 * button, then the `NotificationBanner`s, newest first. The root is a `<section>` named by the
 * heading.
 */
export function NotificationCenterGroup({
  heading,
  onClear,
  clearLabel = "Clear",
  className,
  children,
  ...props
}: NotificationCenterGroupProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn("mac-notification-center-group", className)}
      {...props}
    >
      <div className="mac-notification-center-group-header">
        <h2 id={headingId} className="mac-notification-center-heading">
          {heading}
        </h2>
        {onClear && (
          <BaseButton
            aria-label={clearLabel}
            aria-describedby={headingId}
            className="mac-notification-center-clear"
            onClick={onClear}
          >
            {/* A disc with the cross cut out of it, so the panel shows through. */}
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M7 0a7 7 0 1 1 0 14A7 7 0 0 1 7 0zM4.35 3.7 3.7 4.35 6.35 7 3.7 9.65l.65.65L7 7.65l2.65 2.65.65-.65L7.65 7l2.65-2.65-.65-.65L7 6.35z"
              />
            </svg>
          </BaseButton>
        )}
      </div>
      {children}
    </section>
  );
}

export interface NotificationCenterEmptyProps extends ComponentProps<"p"> {}

/** The text of a view with nothing in it, centred: "No Notifications". */
export function NotificationCenterEmpty({ className, ...props }: NotificationCenterEmptyProps) {
  return <p className={cn("mac-notification-center-empty", className)} {...props} />;
}
