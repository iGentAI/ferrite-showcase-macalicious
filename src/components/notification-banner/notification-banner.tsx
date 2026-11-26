import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";
import "./notification-banner.tokens.css";
import "./notification-banner.css";

export interface NotificationBannerProps extends Omit<ComponentProps<"article">, "title"> {
  /** Name of the app that sent the notification, shown in upper case in the header band. */
  app: ReactNode;
  /** The app's icon, drawn in a 14 pt box before the name. Decorative: hidden from assistive technology. */
  icon?: ReactNode;
  /** When it was delivered, as text: "now", "5m ago", "Yesterday, 3:51 PM". */
  time?: ReactNode;
  /** Title of the notification, in bold. */
  title?: ReactNode;
  /** Second line, in the title's colour and regular weight. */
  subtitle?: ReactNode;
  /** An image at the trailing edge of the text, in a 32 pt box. */
  thumbnail?: ReactNode;
  /**
   * Called when the notification is clicked, to open the item in its app. With it the text
   * of the notification is a button; without it the notification is not interactive.
   */
  onOpen?: () => void;
  /**
   * Called by the clear button, which takes the icon's place while the pointer is over the
   * card or the keyboard focus is in it. Without it there is no clear button.
   */
  onClear?: () => void;
  /**
   * Accessible name of the clear button.
   * @default "Clear"
   */
  clearLabel?: string;
}

/**
 * A delivered notification as Notification Center lists it: a translucent card with the app's
 * icon and name and the delivery time in a header band, then a bold title and the message.
 * The children are the message.
 *
 * The root is an `<article>`; `className`, `style`, `ref` and other attributes go to it. The
 * card has no blur of its own: it is an overlay on the material of the `NotificationCenter`
 * behind it. The banner that slides in at the top right of the screen is `NotificationAlert`.
 */
export function NotificationBanner({
  app,
  icon,
  time,
  title,
  subtitle,
  thumbnail,
  onOpen,
  onClear,
  clearLabel = "Clear",
  className,
  children,
  ...props
}: NotificationBannerProps) {
  const content = (
    <>
      {/* The spaces separate the lines in the accessible name; the column layout drops them. */}
      <span className="mac-notification-banner-text">
        {title != null && <span className="mac-notification-banner-title">{title}</span>}{" "}
        {subtitle != null && <span className="mac-notification-banner-subtitle">{subtitle}</span>}{" "}
        {children != null && <span className="mac-notification-banner-body">{children}</span>}
      </span>
      {thumbnail != null && <span className="mac-notification-banner-thumbnail">{thumbnail}</span>}
    </>
  );
  return (
    <article className={cn("mac-notification-banner", className)} {...props}>
      <div className="mac-notification-banner-header">
        <span className="mac-notification-banner-icon" aria-hidden="true">
          {icon}
        </span>
        {onClear && (
          <BaseButton
            aria-label={clearLabel}
            className="mac-notification-banner-clear"
            onClick={onClear}
          >
            {/* A disc with the cross cut out of it, so the card shows through. */}
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M7 0a7 7 0 1 1 0 14A7 7 0 0 1 7 0zM4.35 3.7 3.7 4.35 6.35 7 3.7 9.65l.65.65L7 7.65l2.65 2.65.65-.65L7.65 7l2.65-2.65-.65-.65L7 6.35z"
              />
            </svg>
          </BaseButton>
        )}
        <span className="mac-notification-banner-app">{app}</span>
        {time != null && <span className="mac-notification-banner-time">{time}</span>}
      </div>
      {onOpen ? (
        <BaseButton className="mac-notification-banner-content" onClick={onOpen}>
          {content}
        </BaseButton>
      ) : (
        <div className="mac-notification-banner-content">{content}</div>
      )}
    </article>
  );
}
