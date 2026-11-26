"use client";

import {
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./circular-slider.tokens.css";
import "./circular-slider.css";

export interface CircularSliderProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children"> {
  /** The value, for a controlled slider. Use `defaultValue` for an uncontrolled one. */
  value?: number;
  /** The value an uncontrolled slider starts with. Defaults to `min`. */
  defaultValue?: number;
  /** Called with the new value while the dial is dragged and on every key press. */
  onValueChange?: (value: number) => void;
  /** Called with the value when a drag ends and after every key press. */
  onValueCommitted?: (value: number) => void;
  /**
   * Value at twelve o'clock, where the dial starts.
   * @default 0
   */
  min?: number;
  /**
   * Value after one full turn clockwise, back at twelve o'clock.
   * @default 100
   */
  max?: number;
  /**
   * Granularity of the value, also the amount an arrow key changes it by.
   * @default 1
   */
  step?: number;
  /**
   * Amount Page Up, Page Down and Shift with an arrow key change the value by.
   * @default 10
   */
  largeStep?: number;
  /**
   * Number of tick marks (`numberOfTickMarks`), drawn as dots spread evenly around the dial,
   * the first at twelve o'clock: a whole number, at most 1000.
   * @default 0
   */
  tickMarks?: number;
  /**
   * Restrict the value to the tick marks (`allowsTickMarkValuesOnly`): the step becomes the
   * distance between two marks.
   * @default false
   */
  tickMarkValuesOnly?: boolean;
  /**
   * Whether the slider ignores input. It leaves the tab order and is drawn at half opacity.
   * @default false
   */
  disabled?: boolean;
  /** Name the value is submitted under: renders a hidden input inside the slider. */
  name?: string;
  /**
   * AppKit control size. AppKit has regular and small circular sliders; `"mini"` is this
   * library's own, smaller still.
   * @default "regular"
   */
  size?: ControlSize;
  /** Ref to the rendered element, the one with `role="slider"`. */
  ref?: Ref<HTMLDivElement>;
}

/** Decimal places of a number, also when it prints in exponent notation (1e-7 has seven). */
function decimals(value: number) {
  const [mantissa = "", exponent = "0"] = String(value).toLowerCase().split("e");
  return Math.max(0, (mantissa.split(".")[1] ?? "").length - Number(exponent));
}

/**
 * Round to the step grid that starts at `min`, without floating-point dust, inside the range.
 * A range or a step that is not a positive, finite number has one value, `min`.
 */
function snap(value: number, min: number, max: number, step: number) {
  if (!(max > min) || !(step > 0) || !Number.isFinite(max - min + step + value)) return min;
  const snapped = min + Math.round((value - min) / step) * step;
  // As many decimals as the grid has; two more absorb a step that is itself a quotient.
  const places = Math.min(100, Math.max(decimals(step), decimals(min)) + 2);
  return Math.min(max, Math.max(min, Number(snapped.toFixed(places))));
}

/**
 * A Catalina circular slider (NSSlider with the circular type): a dial whose dot is dragged
 * around to pick a value that repeats, such as an angle. The value grows clockwise from
 * twelve o'clock and wraps at the ends.
 *
 * There is no Base UI primitive for it: this is a `role="slider"` element following the
 * WAI-ARIA slider pattern. It accepts every `div` attribute; give it a name with
 * `aria-label` or `aria-labelledby`.
 */
export function CircularSlider({
  value: valueProp,
  defaultValue,
  onValueChange,
  onValueCommitted,
  min = 0,
  max = 100,
  step = 1,
  largeStep = 10,
  tickMarks = 0,
  tickMarkValuesOnly = false,
  disabled = false,
  name,
  size = "regular",
  className,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ...props
}: CircularSliderProps) {
  const [internal, setInternal] = useState(defaultValue ?? min);
  const range = max - min;
  const usable = range > 0 && Number.isFinite(range);
  const value = usable ? Math.min(max, Math.max(min, valueProp ?? internal)) : min;
  // Whole tick marks only, at most 1000: any other count would loop or allocate without bound.
  const count = Number.isFinite(tickMarks) ? Math.min(1000, Math.max(0, Math.floor(tickMarks))) : 0;
  const onlyTicks = tickMarkValuesOnly && count > 0;
  const unit = onlyTicks ? range / count : step;

  const change = (next: number) => {
    if (next === value) return false;
    setInternal(next);
    onValueChange?.(next);
    return true;
  };

  /** Value under the pointer: its angle around the centre, clockwise from twelve o'clock. */
  const valueAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left - box.width / 2;
    const y = box.top + box.height / 2 - event.clientY;
    const turn = Math.atan2(x, y) / (2 * Math.PI);
    return snap(min + (turn < 0 ? turn + 1 : turn) * range, min, max, unit);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (disabled || event.defaultPrevented || !usable) return;
    const large = onlyTicks || !(largeStep > 0) ? unit : largeStep;
    const by = event.shiftKey ? large : unit;
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = value + by;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = value - by;
    else if (event.key === "PageUp") next = value + large;
    else if (event.key === "PageDown") next = value - large;
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    else return;
    event.preventDefault();
    // The dial is a circle: past either end the value comes round again, however far past.
    if (next > max || next < min) next = min + ((((next - min) % range) + range) % range);
    next = snap(next, min, max, unit);
    if (change(next)) onValueCommitted?.(next);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(event);
    if (disabled || event.button !== 0 || event.defaultPrevented || !usable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    change(valueAt(event));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    // Disabled in the middle of a drag: the drag is over.
    if (disabled) event.currentTarget.releasePointerCapture(event.pointerId);
    else if (!event.defaultPrevented) change(valueAt(event));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!disabled) onValueCommitted?.(value);
  };

  const ticks = [];
  for (let i = 0; i < count; i++) {
    const at = { "--_a": `${i / count}turn` } as CSSProperties;
    ticks.push(<span key={i} className="mac-circular-slider-tick" style={at} />);
  }

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? "" : undefined}
      data-size={size}
      data-tick-marks={count > 0 ? "" : undefined}
      className={cn("mac-circular-slider", className)}
      {...props}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        endDrag(event);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        endDrag(event);
      }}
    >
      {ticks}
      <span
        className="mac-circular-slider-thumb"
        style={{ "--_a": `${usable ? (value - min) / range : 0}turn` } as CSSProperties}
      />
      {name !== undefined && <input type="hidden" name={name} value={value} disabled={disabled} />}
    </div>
  );
}
