"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { createContext, use, useId, useMemo } from "react";
import { withClassName } from "../../lib/cn";
import "./tooltip.tokens.css";
import "./tooltip.css";

/** What a tooltip is for; it decides where the tooltip appears and how its text is set. */
type TooltipKind = "help-tag" | "expansion";

/** Seconds a pointer rests on a control before its help tag appears, in milliseconds. */
const REST_DELAY = 1500;

const TooltipContext = createContext<{ id: string; kind: TooltipKind } | null>(null);
/** Whether a TooltipProvider above sets the delay, so that a trigger must not set its own. */
const ProvidedDelayContext = createContext(false);

export interface TooltipProviderProps extends BaseTooltip.Provider.Props {
  /**
   * How long the pointer rests on a trigger before its tooltip opens, in milliseconds.
   * @default 1500
   */
  delay?: number;
}

/**
 * Shares timing between the tooltips inside it: once one has been shown, moving to the next
 * control shows its tooltip at once. Optional; wrap a toolbar or a whole window in it.
 */
export function TooltipProvider({ delay = REST_DELAY, ...props }: TooltipProviderProps) {
  return (
    <ProvidedDelayContext value={true}>
      <BaseTooltip.Provider delay={delay} {...props} />
    </ProvidedDelayContext>
  );
}

export interface TooltipProps extends BaseTooltip.Root.Props {
  /**
   * `"help-tag"` describes a control and appears below the pointer. `"expansion"` shows the
   * full text of a clipped or truncated field, laid over the field itself in the regular
   * control font; for a field in another font set `--mac-tooltip-font` on the popup.
   * @default "help-tag"
   */
  kind?: TooltipKind;
}

/**
 * A Catalina help tag (tooltip): a small floating label that describes the control under the
 * pointer. Groups the parts: put a `TooltipTrigger` and a `TooltipPopup` inside.
 *
 * Built on Base UI's Tooltip and takes its Root props (`open`, `defaultOpen`, `onOpenChange`,
 * `disabled`, `trackCursorAxis`). A help tag follows Base UI's cursor tracking by default, so
 * it appears below the pointer as in AppKit; opened from the keyboard it appears below the
 * control.
 */
export function Tooltip({ kind = "help-tag", trackCursorAxis, ...props }: TooltipProps) {
  const id = useId();
  const context = useMemo(() => ({ id, kind }), [id, kind]);
  return (
    <TooltipContext value={context}>
      <BaseTooltip.Root
        trackCursorAxis={trackCursorAxis ?? (kind === "help-tag" ? "both" : "none")}
        {...props}
      />
    </TooltipContext>
  );
}

export interface TooltipTriggerProps extends BaseTooltip.Trigger.Props {
  /**
   * How long the pointer rests on the trigger before the tooltip opens, in milliseconds.
   * Without it the delay is the `TooltipProvider`'s, or 1500 outside a provider.
   */
  delay?: number;
}

/**
 * The control a tooltip describes. Renders a `<button>`; pass the real control with `render`
 * (`render={<PushButton />}`). The tooltip's text becomes the control's accessible
 * description. Shows the tooltip on hover and on keyboard focus.
 */
export function TooltipTrigger({ delay, ...props }: TooltipTriggerProps) {
  const context = use(TooltipContext);
  const provided = use(ProvidedDelayContext);
  return (
    <BaseTooltip.Trigger
      aria-describedby={context?.id}
      delay={delay ?? (provided ? undefined : REST_DELAY)}
      {...props}
    />
  );
}

export interface TooltipPopupProps extends BaseTooltip.Popup.Props {
  /**
   * Side of the pointer, or of the trigger, the tooltip appears on.
   * @default "bottom"
   */
  side?: BaseTooltip.Positioner.Props["side"];
  /**
   * Alignment along that side.
   * @default "start"
   */
  align?: BaseTooltip.Positioner.Props["align"];
  /**
   * Distance from the pointer or the trigger, in points. By default a help tag appears 16 pt
   * below the pointer and an expansion tooltip covers its field.
   */
  sideOffset?: BaseTooltip.Positioner.Props["sideOffset"];
  /**
   * Shift along the side, in points. By default a help tag starts 8 pt after the pointer.
   */
  alignOffset?: BaseTooltip.Positioner.Props["alignOffset"];
  /** Element the tooltip is rendered into; the document body by default. */
  container?: BaseTooltip.Portal.Props["container"];
}

/**
 * The tooltip itself: plain text in a square-cornered floating label, without an arrow. It is
 * rendered in a portal only while open.
 */
export function TooltipPopup({
  side = "bottom",
  align = "start",
  sideOffset,
  alignOffset,
  container,
  className,
  ...props
}: TooltipPopupProps) {
  const context = use(TooltipContext);
  const expansion = context?.kind === "expansion";
  return (
    <BaseTooltip.Portal container={container}>
      <BaseTooltip.Positioner
        side={side}
        align={align}
        // An expansion tooltip lies over its field: it starts at the field's own top edge.
        sideOffset={sideOffset ?? (expansion ? coverAnchor : 16)}
        alignOffset={alignOffset ?? (expansion ? 0 : 8)}
        className="mac-tooltip-positioner"
      >
        <BaseTooltip.Popup
          role="tooltip"
          id={context?.id}
          data-kind={context?.kind ?? "help-tag"}
          className={withClassName("mac-tooltip", className)}
          {...props}
        />
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}

function coverAnchor({ anchor }: { anchor: { height: number } }) {
  return -anchor.height;
}
