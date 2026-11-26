"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { type ComponentProps, createContext, type ReactNode, type Ref, use, useId } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./notification-alert.tokens.css";
import "./notification-alert.css";

/** The alert's `onDismiss`, for the `NotificationAlertClose` buttons inside it. */
const DismissContext = createContext<(() => void) | undefined>(undefined);

export interface NotificationAlertProps extends Omit<ComponentProps<"div">, "title"> {
  /**
   * The title: a few words in title case, on one line; it is cut at the end when it does not
   * fit. It names the notification for assistive technology.
   */
  title: ReactNode;
  /**
   * A second bold line under the title (NSUserNotification's `subtitle`). Provisional: no
   * reference screenshot shows one.
   */
  subtitle?: ReactNode;
  /**
   * The posting application's icon, drawn in a 32 pt box at the leading edge: an `<img>` or an
   * `<svg>` of that size. Give it a text alternative that names the application, or an empty
   * one when the title already does.
   */
  icon?: ReactNode;
  /**
   * The button column at the trailing edge: one or two `NotificationAlertAction` or
   * `NotificationAlertClose` buttons, stacked. One button takes the full height; two share it.
   */
  actions?: ReactNode;
  /**
   * Called when the notification is dismissed: by a `NotificationAlertClose` button, or by
   * Escape while the focus is inside it. The alert holds no open state, so remove it then.
   */
  onDismiss?: () => void;
  /**
   * `"translucent"` is the vibrant notification material, which blurs what is behind the alert
   * in the page; `"opaque"` is the same surface as the reference captures record it, with
   * nothing behind.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
}

/**
 * An alert-style notification (Notification Center's "Alerts" style): the panel that appears
 * under the menu bar and stays until the user acts, with the application's icon, a title, a
 * message (the children) and a column of buttons.
 *
 * It is a surface, not a manager: it draws one notification and reports its dismissal. Where
 * it appears, when, and how several stack is up to the caller. It is not modal and never takes
 * the focus. The root has `role="alert"`, named by the title and described by the message; pass
 * another `role` (`"status"`, `"group"`) when it should not interrupt.
 */
export function NotificationAlert({
  title,
  subtitle,
  icon,
  actions,
  onDismiss,
  material = "translucent",
  className,
  children,
  onKeyDown,
  ...props
}: NotificationAlertProps) {
  const id = useId();
  const hasMessage = children != null && children !== false;
  return (
    <div
      role="alert"
      aria-labelledby={`${id}-title`}
      aria-describedby={hasMessage ? `${id}-message` : undefined}
      data-material={material}
      className={cn("mac-notification-alert", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "Escape" && !event.defaultPrevented && onDismiss) {
          event.preventDefault();
          onDismiss();
        }
      }}
      {...props}
    >
      {icon != null && icon !== false ? (
        <div className="mac-notification-alert-icon">{icon}</div>
      ) : null}
      <div className="mac-notification-alert-content">
        <div id={`${id}-title`} className="mac-notification-alert-title">
          {title}
        </div>
        {subtitle != null && subtitle !== false ? (
          <div className="mac-notification-alert-subtitle">{subtitle}</div>
        ) : null}
        {hasMessage ? (
          <div id={`${id}-message`} className="mac-notification-alert-message">
            {children}
          </div>
        ) : null}
      </div>
      {actions != null && actions !== false ? (
        <div className="mac-notification-alert-actions">
          <DismissContext value={onDismiss}>{actions}</DismissContext>
        </div>
      ) : null}
    </div>
  );
}

export interface NotificationAlertActionProps extends Omit<BaseButton.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A button of the alert's button column: an action that saves the user a trip to the
 * application ("Reply", "Show"). Built on Base UI's Button: accepts `disabled`,
 * `focusableWhenDisabled`, `render` and every native button attribute. It does not dismiss the
 * notification by itself.
 */
export function NotificationAlertAction({ className, ...props }: NotificationAlertActionProps) {
  return (
    <BaseButton className={withClassName("mac-notification-alert-action", className)} {...props} />
  );
}

export interface NotificationAlertCloseProps extends Omit<BaseButton.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * The button that dismisses the notification ("Close"): a `NotificationAlertAction` that calls
 * the alert's `onDismiss` after its own `onClick`, unless that handler prevents the default.
 */
export function NotificationAlertClose({ onClick, ...props }: NotificationAlertCloseProps) {
  const dismiss = use(DismissContext);
  return (
    <NotificationAlertAction
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) dismiss?.();
      }}
      {...props}
    />
  );
}
