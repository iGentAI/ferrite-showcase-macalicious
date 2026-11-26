"use client";

import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "../../lib/cn";
import "./account-header.tokens.css";
import "./account-header.css";

export interface AccountHeaderProps extends Omit<ComponentProps<"div">, "children"> {
  /** The account's display name, set large. It also names the header for assistive technology. */
  name: ReactNode;
  /** A second line under the name, such as “Apple ID, iCloud”. */
  subtitle?: ReactNode;
  /**
   * The account picture, shown in a 64 pt circle: an `<img>` or an inline SVG, 64 pt square.
   * It is decorative, because the name identifies the account. Without one, a neutral
   * silhouette is drawn.
   */
  avatar?: ReactNode;
  /**
   * The destinations at the trailing edge: one or two `PreferencePaneIcon`s (or image
   * buttons), such as Apple ID and Family Sharing.
   */
  children?: ReactNode;
}

/**
 * The account header at the top of System Preferences: the account picture, the name with a
 * line under it, and image buttons for the account's panes at the trailing edge, over a
 * separator.
 *
 * AppKit has no class for it and Base UI no primitive, so it is a plain `<div>` with
 * `role="group"`, named by the account name unless `aria-label` or `aria-labelledby` names it
 * otherwise. The header has no action of its own; the destinations are ordinary buttons.
 */
export function AccountHeader({
  name,
  subtitle,
  avatar,
  className,
  children,
  "aria-label": ariaLabel,
  ...props
}: AccountHeaderProps) {
  const nameId = useId();
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics; this is a labelled group of text and buttons
    <div
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel == null ? nameId : undefined}
      {...props}
      className={cn("mac-account-header", className)}
    >
      <span className="mac-account-header-avatar" aria-hidden="true">
        {avatar}
      </span>
      <div className="mac-account-header-text">
        <span className="mac-account-header-name" id={nameId}>
          {name}
        </span>
        {subtitle == null || subtitle === false ? null : (
          <span className="mac-account-header-subtitle">{subtitle}</span>
        )}
      </div>
      {children == null || children === false ? null : (
        <div className="mac-account-header-destinations">{children}</div>
      )}
    </div>
  );
}
