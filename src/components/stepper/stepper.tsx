"use client";

import {
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./stepper.tokens.css";
import "./stepper.css";

export interface StepperProps
  extends Omit<ComponentProps<"div">, "children" | "defaultValue" | "onChange"> {
  /** The value, when controlled. Use it with `onValueChange`. */
  value?: number;
  /**
   * The value the stepper starts with, when uncontrolled. Without it the stepper starts at
   * `min`, or at 0 when there is no minimum.
   */
  defaultValue?: number;
  /** Called with the new value whenever a click, a held half or a key changes it. */
  onValueChange?: (value: number) => void;
  /** Lowest value (NSStepper.minValue). Without it the stepper has no lower bound. */
  min?: number;
  /** Highest value (NSStepper.maxValue). Without it the stepper has no upper bound. */
  max?: number;
  /**
   * Amount one click or one press of Up or Down changes the value by (NSStepper.increment).
   * @default 1
   */
  step?: number;
  /**
   * Amount Page Up and Page Down change the value by.
   * @default 10
   */
  largeStep?: number;
  /**
   * Whether stepping past `max` continues at `min`, and past `min` at `max`
   * (NSStepper.valueWraps). Needs both bounds; without wrapping the value stops at them.
   * @default false
   */
  valueWraps?: boolean;
  /**
   * Whether holding the mouse button on a half keeps stepping (NSStepper.autorepeat). When
   * false a press steps once.
   * @default true
   */
  autorepeat?: boolean;
  /**
   * Disables the stepper: it leaves the tab order and ignores clicks and keys.
   * @default false
   */
  disabled?: boolean;
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /** Name under which the value is submitted with a form, through a hidden input. */
  name?: string;
  /**
   * Accessible name of the upper half, for assistive technology that reaches the two buttons.
   * @default "Increment"
   */
  incrementLabel?: string;
  /**
   * Accessible name of the lower half.
   * @default "Decrement"
   */
  decrementLabel?: string;
}

/* Auto-repeat while a half is held: the first repeat after 400 ms, then one every 60 ms. */
const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 60;

/** Decimal places of a number, also when it prints in exponent notation (1e-7 has seven). */
const decimals = (value: number) => {
  const [mantissa = "", exponent = "0"] = String(value).toLowerCase().split("e");
  return Math.max(0, (mantissa.split(".")[1] ?? "").length - Number(exponent));
};

/* Original glyph: a chevron 5.9 pt wide and 3.6 pt high with a 1.2 pt arm, a 0.16 pt flat on
   its apex and square-cut ends, as a filled outline in a 12 x 10.5 pt half. The outline is
   fitted in the browser to the pixels of the Notifications pane (@ 960,554,18,10). The lower
   half shows the same drawing mirrored. */
const GLYPH = (
  <svg className="mac-stepper-glyph" viewBox="0 0 12 10.5" aria-hidden="true" focusable="false">
    <path d="M3.07 7.05 5.92 4.33h.16l2.85 2.72-.83.9L6 5.95l-2.1 2z" />
  </svg>
);

const keepFocus = (event: MouseEvent) => event.preventDefault();

/**
 * A Catalina stepper (NSStepper): two stacked arrow halves in one bezel that raise or lower a
 * value shown elsewhere, usually in a field beside it.
 *
 * It is a `role="spinbutton"` element and needs an accessible name (`aria-label` or
 * `aria-labelledby`). It accepts every `<div>` attribute; `aria-valuetext` gives the value a
 * spoken form such as a time or a date.
 */
export function Stepper({
  value: valueProp,
  defaultValue,
  onValueChange,
  min,
  max,
  step = 1,
  largeStep = 10,
  valueWraps = false,
  autorepeat = true,
  disabled = false,
  size = "regular",
  name,
  incrementLabel = "Increment",
  decrementLabel = "Decrement",
  className,
  onKeyDown,
  ...props
}: StepperProps) {
  const [ownValue, setOwnValue] = useState(defaultValue ?? min ?? 0);
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : ownValue;

  /** Move by `delta`, or to `target`; false when the value cannot change. */
  const change = (delta: number, target?: number): boolean => {
    const current = latest.current.value;
    let next = target ?? current + delta;
    const places = Math.max(decimals(current), decimals(delta));
    if (target === undefined && Number.isFinite(next) && places <= 100) {
      // 0.1 + 0.2 is not 0.3: keep the decimals of the operands.
      next = Number(next.toFixed(places));
    }
    if (valueWraps && min !== undefined && max !== undefined) {
      if (next > max) next = min;
      else if (next < min) next = max;
    } else {
      if (max !== undefined && next > max) next = max;
      if (min !== undefined && next < min) next = min;
    }
    if (next === current) return false;
    if (!controlled) {
      latest.current.value = next;
      setOwnValue(next);
    }
    onValueChange?.(next);
    return true;
  };

  // What the repeat timer reads: the current value and props, and a `change` that sees them.
  const latest = useRef({ value, change, step, autorepeat });
  useEffect(() => {
    latest.current = { value, change, step, autorepeat };
  });

  const timer = useRef(0);
  const stop = () => window.clearTimeout(timer.current);
  // biome-ignore lint/correctness/useExhaustiveDependencies: stops the repeat when the stepper is disabled or unmounted
  useEffect(() => stop, [disabled]);

  const hold = (event: PointerEvent, direction: 1 | -1) => {
    if (event.button !== 0 || disabled) return;
    stop();
    const repeat = () => {
      const now = latest.current;
      if (now.autorepeat && now.change(direction * now.step)) {
        timer.current = window.setTimeout(repeat, REPEAT_INTERVAL);
      }
    };
    if (change(direction * step) && autorepeat) {
      timer.current = window.setTimeout(repeat, REPEAT_DELAY);
    }
  };
  // A pointer press has already stepped by the time its click arrives (detail of 1 or more).
  // A click that no pointer made (detail 0) comes from assistive technology and steps once.
  const click = (event: MouseEvent, direction: 1 | -1) => {
    if (event.detail === 0 && !disabled) change(direction * step);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const { key } = event;
    if (key === "ArrowUp") change(step);
    else if (key === "ArrowDown") change(-step);
    else if (key === "PageUp") change(largeStep);
    else if (key === "PageDown") change(-largeStep);
    else if (key === "Home" && min !== undefined) change(0, min);
    else if (key === "End" && max !== undefined) change(0, max);
    else return;
    event.preventDefault();
  };

  return (
    <div
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-disabled={disabled || undefined}
      data-size={size}
      data-disabled={disabled ? "" : undefined}
      {...props}
      className={cn("mac-stepper", className)}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="mac-stepper-increment"
        tabIndex={-1}
        aria-label={incrementLabel}
        disabled={disabled}
        onMouseDown={keepFocus}
        onPointerDown={(event) => hold(event, 1)}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onClick={(event) => click(event, 1)}
      >
        {GLYPH}
      </button>
      <button
        type="button"
        className="mac-stepper-decrement"
        tabIndex={-1}
        aria-label={decrementLabel}
        disabled={disabled}
        onMouseDown={keepFocus}
        onPointerDown={(event) => hold(event, -1)}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onClick={(event) => click(event, -1)}
      >
        {GLYPH}
      </button>
      {name !== undefined && <input type="hidden" name={name} value={value} disabled={disabled} />}
    </div>
  );
}
