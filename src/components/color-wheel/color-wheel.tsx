"use client";

import type { ComponentProps, CSSProperties, PointerEvent } from "react";
import { cn } from "../../lib/cn";
import { type Hsva, useColorValue } from "../../lib/color-value";
import { Slider } from "../slider";
import "./color-wheel.tokens.css";
import "./color-wheel.css";

export interface ColorWheelProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children"> {
  /** The colour, when controlled, as `#rrggbb` or `#rrggbbaa`. Use it with `onValueChange`. */
  value?: string;
  /**
   * The colour the picker starts with, when uncontrolled.
   * @default "#ffffff"
   */
  defaultValue?: string;
  /** Called with the new colour, as lower-case `#rrggbb` (`#rrggbbaa` when it is not opaque). */
  onValueChange?: (value: string) => void;
  /**
   * Whether the picker ignores the pointer and the keyboard and is drawn dimmed.
   * @default false
   */
  disabled?: boolean;
  /**
   * Accessible name of the area the colour is picked in.
   * @default "Hue and saturation"
   */
  areaLabel?: string;
}

export interface ColorSpectrumProps extends ColorWheelProps {}

const unit = (n: number) => Math.min(1, Math.max(0, n));

/** Where a colour is in the area, as fractions of its width and height. */
function toPoint(wheel: boolean, [h, s, v]: Hsva): [number, number] {
  if (!wheel) return [h / 360, v < 1 ? 1 - v / 2 : s / 2];
  const angle = (h * Math.PI) / 180;
  return [0.5 + (s / 2) * Math.cos(angle), 0.5 - (s / 2) * Math.sin(angle)];
}

/** The colour at a point of the area. The wheel keeps the brightness; the spectrum sets it. */
function fromPoint(wheel: boolean, x: number, y: number, [, , v, a]: Hsva): Hsva {
  if (!wheel) return [Math.min(unit(x) * 360, 359.9), unit(y * 2), unit(2 - y * 2), a];
  const dx = x - 0.5;
  const dy = 0.5 - y;
  const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  return [h, unit(Math.hypot(dx, dy) * 2), v, a];
}

const KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function Picker({
  wheel,
  value,
  defaultValue = "#ffffff",
  onValueChange,
  disabled = false,
  areaLabel = "Hue and saturation",
  className,
  ...props
}: ColorWheelProps & { wheel: boolean }) {
  const [color, setColor] = useColorValue(value, defaultValue, onValueChange);
  const [x, y] = toPoint(wheel, color);
  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setColor(
      fromPoint(
        wheel,
        (event.clientX - box.left) / box.width,
        (event.clientY - box.top) / box.height,
        color,
      ),
    );
  };
  return (
    <div
      data-shape={wheel ? "wheel" : "spectrum"}
      data-disabled={disabled ? "" : undefined}
      className={cn("mac-color-wheel", className)}
      {...props}
    >
      <div
        role="slider"
        tabIndex={disabled ? undefined : 0}
        aria-label={areaLabel}
        aria-disabled={disabled || undefined}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(color[0])}
        aria-valuetext={`Hue ${Math.round(color[0])}°, saturation ${Math.round(color[1] * 100)}%, brightness ${Math.round(color[2] * 100)}%`}
        className="mac-color-wheel-area"
        style={{ "--_x": x, "--_y": y, "--_v": color[2] } as CSSProperties}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          pick(event);
        }}
        onPointerMove={(event) => {
          if (!disabled && event.currentTarget.hasPointerCapture?.(event.pointerId)) pick(event);
        }}
        onKeyDown={(event) => {
          const step = KEYS[event.key];
          if (disabled || !step) return;
          // The arrow keys are the picker's: they must not also scroll the page.
          event.preventDefault();
          const by = event.shiftKey ? 0.1 : 0.02;
          setColor(fromPoint(wheel, unit(x + step[0] * by), unit(y + step[1] * by), color));
        }}
      />
      {wheel ? (
        <Slider
          aria-label="Brightness"
          disabled={disabled}
          value={color[2] * 100}
          onValueChange={(v) => setColor([color[0], color[1], v / 100, color[3]])}
        />
      ) : null}
    </div>
  );
}

/**
 * The colour wheel of the Colors panel (NSColorPanel's wheel picker): a disc with the hues
 * around it and white at its centre, in which a point is chosen, and a brightness slider under
 * it.
 *
 * The disc is one focusable `slider`; the arrow keys move the point, by a larger step with
 * Shift. The brightness slider is the library's `Slider`. It takes every `<div>` prop.
 */
export function ColorWheel(props: ColorWheelProps) {
  return <Picker wheel {...props} />;
}

/**
 * The spectrum of the Colors panel's image palettes: a rectangle with the hues from left to
 * right, white along its top edge and black along its bottom edge. A point chosen in it sets
 * hue, saturation and brightness at once, so it has no slider. It holds the colours that are
 * fully saturated or fully bright; a colour that is neither is marked at its hue and brightness,
 * and the next point chosen replaces it. Same props as `ColorWheel`.
 */
export function ColorSpectrum(props: ColorSpectrumProps) {
  return <Picker wheel={false} {...props} />;
}
