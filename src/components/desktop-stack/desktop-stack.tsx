"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useControlled } from "../../lib/use-controlled";
import { DesktopIcon, type DesktopIconProps } from "../desktop-icon";
import "./desktop-stack.tokens.css";
import "./desktop-stack.css";

const NOT_PRESSED = { "aria-pressed": undefined };

export interface DesktopStackProps
  extends Omit<
    DesktopIconProps,
    "icon" | "selected" | "defaultSelected" | "onSelectedChange" | "onOpen"
  > {
  /** The name of the group, shown under the pile: "Images", "PDF Documents". */
  label: ReactNode;
  /**
   * The preview of the newest file, drawn on the front sheet of the pile: an image or any
   * element. Decorative.
   */
  thumbnail?: ReactNode;
  /** Whether the stack is expanded, when you control it. */
  open?: boolean;
  /**
   * Whether the stack starts expanded, when you do not control it.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called with the new state when a click or the keyboard expands or collapses the stack. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * A pile of the desktop's files of one kind. A click expands it in place: its files, the
 * children, take the cells that follow, and the pile becomes a placeholder that collapses it.
 */
export function DesktopStack({
  label,
  thumbnail,
  open,
  defaultOpen = false,
  onOpenChange,
  className,
  children,
  onClick,
  ...props
}: DesktopStackProps) {
  const [isOpen, setOpen] = useControlled(open, defaultOpen, onOpenChange);

  return (
    <>
      <DesktopIcon
        // A stack expands; it is not a toggle that stays pressed.
        {...NOT_PRESSED}
        aria-expanded={isOpen}
        data-open={isOpen ? "" : undefined}
        className={cn("mac-desktop-stack", className)}
        icon={
          <span className="mac-desktop-stack-pile">
            {isOpen ? (
              // The placeholder, an original drawing on the 64 pt tile: the edges of a turned
              // sheet a point clear of a 55 by 40 pt box, and a 20 by 14 pt down triangle.
              <svg className="mac-desktop-stack-collapse" viewBox="0 0 64 64" aria-hidden="true">
                <path
                  d="M8.3 9.6L28.8 13L7.7 13zM60.5 18.2L62.3 18.5L60.5 29.6zM35.2 55L55.7 58.4L56.3 55zM3.5 38.4L1.7 49.5L3.5 49.8zM22 28.25h20l-10 14z"
                  fill="currentColor"
                />
                <rect x="5.5" y="15" width="53" height="38" rx="2" strokeWidth="2" />
              </svg>
            ) : (
              <span className="mac-desktop-stack-sheet">{thumbnail}</span>
            )}
          </span>
        }
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setOpen(!isOpen);
        }}
        {...props}
      >
        {label}
      </DesktopIcon>
      {isOpen ? children : null}
    </>
  );
}
