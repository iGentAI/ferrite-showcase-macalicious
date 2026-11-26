"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { useRender } from "@base-ui/react/use-render";
import type { CSSProperties, ReactNode, Ref } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./map-controls.tokens.css";
import "./map-controls.css";

export interface MapControlsProps extends useRender.ComponentProps<"div"> {
  /**
   * The corner of the map the controls are pinned to. The map (or any ancestor) must be
   * positioned. `"none"` leaves the group in the flow, to be placed by its owner.
   * @default "bottom-trailing"
   */
  placement?: "bottom-trailing" | "bottom-leading" | "top-trailing" | "top-leading" | "none";
  /**
   * Stacks the controls in a column, centred on one another, 6 pt apart: the compass above the
   * zoom pair. By default they stand in a row, 12 pt apart, aligned at the bottom.
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical";
}

/**
 * A group of controls that float over a map, as in Maps and Find My: it pins `MapButton`,
 * `MapZoomControl`, `MapCompass` and `MapTypeControl` to a corner of the map, 15 pt from its
 * edges, where they stay while the map pans.
 *
 * Nest a vertical group in a horizontal one for the cluster of Find My (a locate button beside
 * a compass over a zoom pair); only the outer one is placed. Renders a `<div role="group">`;
 * name it with `aria-label`.
 */
export function MapControls({
  placement = "bottom-trailing",
  orientation = "horizontal",
  className,
  render,
  ref,
  ...props
}: MapControlsProps) {
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "group",
      "data-placement": placement,
      "data-orientation": orientation,
      ...props,
      className: cn("mac-map-controls", className),
    },
  });
}

export interface MapButtonProps extends Omit<BaseButton.Props, "ref"> {
  /**
   * The button's shape. `"bordered"` is the small button of Maps, with a hairline edge and
   * 4 pt corners (the "Show" pull-down); `"rounded"` is the borderless button of Find My,
   * with 6 pt corners (the button that shows the current location).
   * @default "bordered"
   */
  variant?: "bordered" | "rounded";
  /**
   * Draws a chevron at the trailing edge, for a button that opens a menu.
   * @default false
   */
  chevron?: boolean;
  /** Ref to the button element. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * One button over a map: a glyph (give it an `aria-label`) or a short title. Built on Base
 * UI's Button, so it also takes `disabled`, `focusableWhenDisabled` and `render`, which is how
 * a menu's trigger becomes this button.
 */
export function MapButton({
  variant = "bordered",
  chevron = false,
  className,
  children,
  ...props
}: MapButtonProps) {
  return (
    <BaseButton
      data-variant={variant}
      {...props}
      className={withClassName("mac-map-controls-button", className)}
    >
      {children}
      {chevron ? <span className="mac-map-controls-button-chevron" aria-hidden="true" /> : null}
    </BaseButton>
  );
}

export interface MapZoomControlProps extends Omit<useRender.ComponentProps<"div">, "children"> {
  /** Called when the plus half is activated. */
  onZoomIn?: () => void;
  /** Called when the minus half is activated. */
  onZoomOut?: () => void;
  /**
   * Disables the plus half: the map is at its closest.
   * @default false
   */
  zoomInDisabled?: boolean;
  /**
   * Disables the minus half: the map is at its widest.
   * @default false
   */
  zoomOutDisabled?: boolean;
  /**
   * Accessible name of the plus half.
   * @default "Zoom in"
   */
  zoomInLabel?: string;
  /**
   * Accessible name of the minus half.
   * @default "Zoom out"
   */
  zoomOutLabel?: string;
}

/**
 * The zoom pair of a map (`MKZoomControl`): a minus and a plus button side by side,
 * 56 x 20 pt. The map itself is zoomed by its owner in `onZoomIn` and `onZoomOut`. A disabled
 * half stays in the Tab order, so focus is not lost when the map reaches a limit. Renders a
 * `<div role="group">` named "Zoom"; `aria-label` renames it.
 */
export function MapZoomControl({
  onZoomIn,
  onZoomOut,
  zoomInDisabled = false,
  zoomOutDisabled = false,
  zoomInLabel = "Zoom in",
  zoomOutLabel = "Zoom out",
  className,
  render,
  ref,
  ...props
}: MapZoomControlProps) {
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "group",
      "aria-label": "Zoom",
      ...props,
      className: cn("mac-map-controls-zoom", className),
      children: (
        <>
          <BaseButton
            className="mac-map-controls-zoom-button"
            data-zoom="out"
            aria-label={zoomOutLabel}
            disabled={zoomOutDisabled}
            focusableWhenDisabled
            onClick={onZoomOut}
          />
          <BaseButton
            className="mac-map-controls-zoom-button"
            data-zoom="in"
            aria-label={zoomInLabel}
            disabled={zoomInDisabled}
            focusableWhenDisabled
            onClick={onZoomIn}
          />
        </>
      ),
    },
  });
}

export interface MapCompassProps extends Omit<useRender.ComponentProps<"div">, "children"> {
  /**
   * The map's heading in degrees clockwise from north: the direction that is up on the map.
   * The compass rose turns against it, so its red mark keeps pointing north.
   * @default 0
   */
  heading?: number;
  /** Called when the compass ring is activated: the owner turns the map north up. */
  onNorthUp?: () => void;
  /** Whether the map is shown in 3D. Controlled; see `defaultPitched`. */
  pitched?: boolean;
  /**
   * Whether the map starts in 3D, when `pitched` is not given.
   * @default false
   */
  defaultPitched?: boolean;
  /** Called with the new state when the 3D button in the middle is toggled. */
  onPitchedChange?: (pitched: boolean) => void;
  /**
   * Disables the 3D button, as Find My does where 3D is not offered.
   * @default false
   */
  pitchDisabled?: boolean;
  /**
   * Leaves the 3D button out: a plain compass (`MKCompassButton`).
   * @default false
   */
  hidePitch?: boolean;
  /**
   * Accessible name of the ring, the button that turns the map north up.
   * @default "Face north"
   */
  northLabel?: string;
  /**
   * The 3D button's content, which is also its accessible name.
   * @default "3D"
   */
  pitchLabel?: ReactNode;
}

/**
 * The compass of a map with the 3D button of Maps in its middle: a 53 pt disc whose rose turns
 * with the map's heading. The ring is a button that asks for north up; the middle is a toggle
 * button, built on Base UI's Toggle. The face is an original drawing in CSS, not Apple's
 * artwork. Renders a `<div role="group">` named "Compass"; `aria-label` renames it.
 */
export function MapCompass({
  heading = 0,
  onNorthUp,
  pitched,
  defaultPitched = false,
  onPitchedChange,
  pitchDisabled = false,
  hidePitch = false,
  northLabel = "Face north",
  pitchLabel = "3D",
  className,
  render,
  ref,
  ...props
}: MapCompassProps) {
  const turn = Number.isFinite(heading) ? -heading : 0;
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "group",
      "aria-label": "Compass",
      "data-plain": hidePitch ? "" : undefined,
      ...props,
      className: cn("mac-map-controls-compass", className),
      children: (
        <>
          <BaseButton
            className="mac-map-controls-compass-ring"
            aria-label={northLabel}
            onClick={onNorthUp}
          >
            <span
              className="mac-map-controls-compass-rose"
              style={{ rotate: `${turn}deg` } as CSSProperties}
              aria-hidden="true"
            >
              <span className="mac-map-controls-compass-north" />
              <span className="mac-map-controls-compass-tick" data-point="east" />
              <span className="mac-map-controls-compass-tick" data-point="south" />
              <span className="mac-map-controls-compass-tick" data-point="west" />
            </span>
          </BaseButton>
          {hidePitch ? null : (
            <BaseToggle
              className="mac-map-controls-compass-pitch"
              pressed={pitched}
              defaultPressed={defaultPitched}
              onPressedChange={(next) => onPitchedChange?.(next)}
              disabled={pitchDisabled}
            >
              {pitchLabel}
            </BaseToggle>
          )}
        </>
      ),
    },
  });
}

export interface MapTypeControlProps extends Omit<BaseRadioGroup.Props, "ref"> {
  /** Ref to the root element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The map-type switch that Find My floats over its map (Map, Hybrid, Satellite): a segmented
 * control in iPad metrics, 22 pt tall, whose selected segment is a raised pill. It is a radio
 * group, built on Base UI's RadioGroup, so it takes `value`, `defaultValue`, `onValueChange`,
 * `disabled` and `name`; the arrow keys move the selection. Put `MapTypeOption`s inside and
 * name it with `aria-label`. Segments share its width equally.
 */
export function MapTypeControl({ className, ...props }: MapTypeControlProps) {
  return (
    <BaseRadioGroup {...props} className={withClassName("mac-map-controls-type", className)} />
  );
}

export interface MapTypeOptionProps extends Omit<BaseRadio.Root.Props, "ref"> {
  /** Ref to the radio element. */
  ref?: Ref<HTMLSpanElement>;
}

/** One segment of a `MapTypeControl`: a radio whose children are its title. */
export function MapTypeOption({ className, children, ...props }: MapTypeOptionProps) {
  return (
    <span className="mac-map-controls-type-segment">
      <BaseRadio.Root
        {...props}
        className={withClassName("mac-map-controls-type-option", className)}
      >
        {children}
      </BaseRadio.Root>
    </span>
  );
}
