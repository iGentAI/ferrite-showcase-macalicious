"use client";

import { Popover as BasePopover } from "@base-ui/react/popover";
import { Separator as BaseSeparator } from "@base-ui/react/separator";
import { withClassName } from "../../lib/cn";
import "./popover.tokens.css";
import "./popover.css";

/**
 * The arrow's outline on a 13 x 29 pt grid, pointing left, the popover's edge at x = 13:
 * straight sides that rise 0.82 pt per point, a fillet where they leave the edge and a rounded
 * tip. Fitted to the Calendar popover (Light-Calendar, the outline between y = 962 and 1017).
 */
const ARROW =
  "M13 0C13 3 11.8 4.4 10 6.25L1.5 13.2C.6 13.95.6 15.05 1.5 15.8L10 22.75C11.8 24.6 13 26 13 29";

export interface PopoverProps extends BasePopover.Root.Props {}

/**
 * A Catalina popover (NSPopover): a small view that appears next to the control that opened
 * it, with an arrow pointing at it. Groups the parts: put a `PopoverTrigger` and a
 * `PopoverPopup` inside.
 *
 * Built on Base UI's Popover and takes its Root props: `open`, `defaultOpen`, `onOpenChange`,
 * `modal`. A click outside, the focus moving elsewhere or Escape closes it, like a transient
 * NSPopover; cancel the `outside-press` and `focus-out` reasons in `onOpenChange` for an
 * application-defined one.
 */
export function Popover(props: PopoverProps) {
  return <BasePopover.Root {...props} />;
}

export interface PopoverTriggerProps extends BasePopover.Trigger.Props {}

/**
 * The control the popover belongs to. Renders a `<button>`; pass the real control with
 * `render` (`render={<PushButton />}`).
 */
export function PopoverTrigger(props: PopoverTriggerProps) {
  return <BasePopover.Trigger {...props} />;
}

export interface PopoverPopupProps extends BasePopover.Popup.Props {
  /**
   * The side of the anchor the popover appears on (NSPopover's preferred edge). It moves to
   * the opposite side when there is no room.
   * @default "bottom"
   */
  side?: BasePopover.Positioner.Props["side"];
  /**
   * Alignment along that side.
   * @default "center"
   */
  align?: BasePopover.Positioner.Props["align"];
  /**
   * Distance between the anchor and the popover's edge, in points. By default the arrow's tip
   * touches the anchor (13 pt), and a popover without an arrow sits 4 pt away.
   */
  sideOffset?: BasePopover.Positioner.Props["sideOffset"];
  /**
   * Shift along the side, in points.
   * @default 0
   */
  alignOffset?: BasePopover.Positioner.Props["alignOffset"];
  /** What the popover points at, when it is not the trigger: an element, a ref or a rectangle. */
  anchor?: BasePopover.Positioner.Props["anchor"];
  /**
   * Draw the arrow.
   * @default true
   */
  arrow?: boolean;
  /** How the popover avoids the edges of the viewport; Base UI's default flips the side. */
  collisionAvoidance?: BasePopover.Positioner.Props["collisionAvoidance"];
  /** Element the popover is rendered into; the document body by default. */
  container?: BasePopover.Portal.Props["container"];
  /**
   * Keep the popover in the DOM while it is closed.
   * @default false
   */
  keepMounted?: boolean;
}

/**
 * The popover itself: a rounded panel of the popover material with a hairline, a small shadow
 * and an arrow, all one outline. Its content is yours to lay out; it has 12 pt of padding
 * unless `--mac-popover-padding` says otherwise. It is rendered in a portal only while open,
 * takes the focus when it opens and returns it to the trigger when it closes.
 */
export function PopoverPopup({
  side = "bottom",
  align = "center",
  sideOffset,
  alignOffset = 0,
  anchor,
  arrow = true,
  collisionAvoidance,
  container,
  keepMounted = false,
  className,
  children,
  ...props
}: PopoverPopupProps) {
  return (
    <BasePopover.Portal container={container} keepMounted={keepMounted}>
      <BasePopover.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset ?? (arrow ? 13 : 4)}
        alignOffset={alignOffset}
        anchor={anchor}
        arrowPadding={8}
        collisionAvoidance={collisionAvoidance}
        className="mac-popover-positioner"
      >
        <BasePopover.Popup className={withClassName("mac-popover", className)} {...props}>
          {arrow ? (
            <BasePopover.Arrow className="mac-popover-arrow">
              <span className="mac-popover-arrow-shape">
                <span className="mac-popover-arrow-clip">
                  <svg viewBox="0 0 13 29" width="13" height="29" aria-hidden="true">
                    <path className="mac-popover-arrow-fill" d={`${ARROW}Z`} />
                    <path className="mac-popover-arrow-edge" d={ARROW} />
                    <path className="mac-popover-arrow-rim" d={ARROW} />
                  </svg>
                </span>
              </span>
            </BasePopover.Arrow>
          ) : null}
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

export interface PopoverTitleProps extends BasePopover.Title.Props {}

/** A heading that names the popover for assistive technology: 15 pt, as in Calendar. */
export function PopoverTitle({ className, ...props }: PopoverTitleProps) {
  return <BasePopover.Title className={withClassName("mac-popover-title", className)} {...props} />;
}

export interface PopoverDescriptionProps extends BasePopover.Description.Props {}

/** A paragraph that assistive technology reads as the popover's description. */
export function PopoverDescription({ className, ...props }: PopoverDescriptionProps) {
  return (
    <BasePopover.Description
      className={withClassName("mac-popover-description", className)}
      {...props}
    />
  );
}

export interface PopoverCloseProps extends BasePopover.Close.Props {}

/**
 * A button that closes the popover. Renders a `<button>`; pass the real control with `render`
 * (`render={<PushButton />}`).
 */
export function PopoverClose(props: PopoverCloseProps) {
  return <BasePopover.Close {...props} />;
}

export interface PopoverSeparatorProps extends BaseSeparator.Props {}

/**
 * A 1 pt line between groups of a popover's content, in the colour lines have on the popover
 * material, which in Dark Aqua is lighter than a window's separator. Built on Base UI's
 * Separator: `role="separator"`; pass `aria-hidden` when the line is purely visual.
 */
export function PopoverSeparator({ className, ...props }: PopoverSeparatorProps) {
  return <BaseSeparator className={withClassName("mac-popover-separator", className)} {...props} />;
}
