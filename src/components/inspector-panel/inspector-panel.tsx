"use client";

import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import type { ComponentProps, MouseEvent, ReactNode, Ref } from "react";
import { cn, withClassName } from "../../lib/cn";
import { TitleBar, type TitleBarProps } from "../title-bar";
import { Window, WindowBody, type WindowProps } from "../window";
import { WindowControls } from "../window-controls";
import "./inspector-panel.tokens.css";
import "./inspector-panel.css";

export interface InspectorPanelProps extends Omit<WindowProps, "title" | "variant" | "fullScreen"> {
  /** The window title: "<name> Info" for an Info window, a noun phrase for an inspector. */
  title?: ReactNode;
  /** The 16 pt proxy icon shown before the title. Decorative. */
  icon?: ReactNode;
  /**
   * The window controls. Pass `null` for none.
   * @default the usual three; the close button calls `onClose`
   */
  controls?: ReactNode;
  /** Called when the close button is activated. */
  onClose?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Called when the primary pointer button goes down on the title bar itself, not on a window
   * control in it. A window manager starts moving the window here.
   */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** Called when the title bar itself is double-clicked. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /**
   * Frame width: a number of points or any CSS length. Finder's Info window is 265 points
   * wide and is not resizable in width.
   * @default 265
   */
  width?: number | string;
}

/**
 * An inspector or Info window (Finder's Get Info): a narrow `Window` with a standard title
 * bar and a body of stacked sections that collapse and expand, in small text. Children are an
 * `InspectorPanelHeader` and `InspectorPanelSection` elements. The frame is as tall as its
 * sections unless `height` is set, in which case the body scrolls.
 */
export function InspectorPanel({
  title,
  icon,
  controls,
  onClose,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 265,
  className,
  children,
  ...props
}: InspectorPanelProps) {
  return (
    <Window width={width} className={cn("mac-inspector-panel", className)} {...props}>
      <TitleBar
        title={title}
        icon={icon}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
        controls={controls !== undefined ? controls : <WindowControls onClose={onClose} />}
      />
      <WindowBody className="mac-inspector-panel-body">{children}</WindowBody>
    </Window>
  );
}

export interface InspectorPanelHeaderProps extends Omit<ComponentProps<"div">, "title"> {
  /** The item's 32 pt icon. Decorative. */
  icon?: ReactNode;
  /** The item's name, in bold. */
  title?: ReactNode;
  /** What stands at the trailing edge of the name's line, in bold: the item's size. */
  detail?: ReactNode;
  /** The secondary line under the name, such as the modification date. */
  subtitle?: ReactNode;
}

/**
 * The summary at the top of an Info window: icon, bold name with a detail at the trailing
 * edge, and a secondary line. Children go below, across the panel (Finder's tags field).
 */
export function InspectorPanelHeader({
  icon,
  title,
  detail,
  subtitle,
  className,
  children,
  ...props
}: InspectorPanelHeaderProps) {
  return (
    <div className={cn("mac-inspector-panel-header", className)} {...props}>
      <div className="mac-inspector-panel-header-summary">
        <span className="mac-inspector-panel-header-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="mac-inspector-panel-header-title">{title}</span>
        <span className="mac-inspector-panel-header-detail">{detail}</span>
        <span className="mac-inspector-panel-header-subtitle">{subtitle}</span>
      </div>
      {children}
    </div>
  );
}

export interface InspectorPanelSectionProps
  extends Omit<BaseCollapsible.Root.Props, "ref" | "title"> {
  /** The section's title, in bold after the disclosure triangle. Finder ends it with a colon. */
  title: ReactNode;
  /**
   * Keep the content in the DOM while the section is collapsed.
   * @default false
   */
  keepMounted?: boolean;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * One collapsible section of an inspector: a header with a disclosure triangle and a bold
 * title, and the content it shows and hides. Built on Base UI's Collapsible, so it takes
 * `open`, `defaultOpen`, `onOpenChange` and `disabled`. The header is one button; Right Arrow
 * expands and Left Arrow collapses it, as AppKit's disclosure triangle does.
 */
export function InspectorPanelSection({
  title,
  keepMounted = false,
  className,
  children,
  ...props
}: InspectorPanelSectionProps) {
  return (
    <BaseCollapsible.Root
      className={withClassName("mac-inspector-panel-section", className)}
      {...props}
    >
      <BaseCollapsible.Trigger
        className="mac-inspector-panel-section-header"
        onKeyDown={(event) => {
          if (event.defaultPrevented) return;
          const open = event.currentTarget.getAttribute("aria-expanded") === "true";
          if (event.key === (open ? "ArrowLeft" : "ArrowRight")) {
            // The key is the section's: it must not also scroll what is around the panel.
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
      >
        {/* The disclosure triangle's measured shape, 7.5 x 9 pt in a 13 pt frame. */}
        <svg
          className="mac-inspector-panel-section-triangle"
          viewBox="0 0 13 13"
          width="13"
          height="13"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 2l7.5 4.5L3 11z" fill="currentColor" />
        </svg>
        <span className="mac-inspector-panel-section-title">{title}</span>
      </BaseCollapsible.Trigger>
      <BaseCollapsible.Panel
        keepMounted={keepMounted}
        className="mac-inspector-panel-section-content"
      >
        {children}
      </BaseCollapsible.Panel>
    </BaseCollapsible.Root>
  );
}

export interface InspectorPanelListProps extends ComponentProps<"dl"> {}

/**
 * A list of labelled values in a section (a description list): right-aligned labels and their
 * values in two columns. The label column fits its longest label; set
 * `--mac-inspector-panel-label-width` to line several lists up.
 */
export function InspectorPanelList({ className, ...props }: InspectorPanelListProps) {
  return <dl className={cn("mac-inspector-panel-list", className)} {...props} />;
}

export interface InspectorPanelItemProps extends ComponentProps<"div"> {
  /** The label, right-aligned in the label column. Finder ends it with a colon. */
  label?: ReactNode;
}

/** One row of an `InspectorPanelList`: a label and its value (the children), which may wrap. */
export function InspectorPanelItem({
  label,
  className,
  children,
  ...props
}: InspectorPanelItemProps) {
  return (
    <div className={cn("mac-inspector-panel-item", className)} {...props}>
      <dt className="mac-inspector-panel-item-label">{label}</dt>
      <dd className="mac-inspector-panel-item-value">{children}</dd>
    </div>
  );
}
