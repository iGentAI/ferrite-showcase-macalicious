"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps, CSSProperties, Ref } from "react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./calculator-keypad.tokens.css";
import "./calculator-keypad.css";

/** The symbols a key can draw instead of text. */
export type CalculatorKeypadGlyph =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "equals"
  | "negate";

/* Original drawings on a 16 pt grid, to the pixels measured in Light-Calculator: 2.5 pt strokes,
   12 to 12.5 pt wide; the dots of the division sign are 3 pt across. */
const GLYPHS: Record<CalculatorKeypadGlyph, { name: string; path: string }> = {
  add: { name: "Add", path: "M1.75 7.75h12.5M8 1.25v13" },
  subtract: { name: "Subtract", path: "M2 8h12" },
  multiply: { name: "Multiply", path: "M3.25 3l9.5 9.5m0-9.5l-9.5 9.5" },
  divide: { name: "Divide", path: "M1.75 8h12.5" }, // and two dots, below
  equals: { name: "Equals", path: "M1.75 5h12.5m-12.5 5.5h12.5" },
  negate: { name: "Negate", path: "M.5 5.15h6.25M3.6 1.75v6.5M12.7 1.75L4 14.25M9.8 11.45h6.2" },
};

export interface CalculatorKeypadProps extends ComponentProps<"div"> {}

/**
 * The face of Catalina's Calculator: a display above a grid of flat keys, dark in both
 * appearances. Children are one `CalculatorKeypadDisplay` followed by `CalculatorKeypadKey`s,
 * which fill the grid row by row.
 *
 * It is presentational: it draws the keys and reports their clicks, and holds no number. The
 * default grid is the basic calculator, four columns and five rows of keys, 232 by 321 pt; set
 * `--mac-calculator-keypad-columns` and `--mac-calculator-keypad-rows` for another layout. The
 * root is a `group`: give it an `aria-label`.
 */
export function CalculatorKeypad({ className, ...props }: CalculatorKeypadProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of buttons and an output, not a form fieldset
    <div role="group" className={cn("mac-calculator-keypad", className)} {...props} />
  );
}

/**
 * Measure the display's text and set the scale at which it fills the display at most. Does
 * nothing where there is no layout to measure.
 */
function fitDisplayText(span: HTMLElement | null) {
  const display = span?.parentElement;
  if (!span || !display) return;
  const box = getComputedStyle(display);
  const available =
    display.clientWidth -
    (Number.parseFloat(box.paddingLeft) || 0) -
    (Number.parseFloat(box.paddingRight) || 0);
  // The text's rectangle is measured after an ancestor's transform and the widths above before
  // it: take the transform's horizontal scale, which the display's own two widths give, out.
  const zoom = display.getBoundingClientRect().width / display.offsetWidth;
  const unit = zoom > 0 && Number.isFinite(zoom) ? zoom : 1;
  let current = Number(display.style.getPropertyValue("--_scale")) || 1;
  // The first pass takes the scale at which the text would fill the display, larger or
  // smaller than the estimate. Where glyph advances are rounded to whole pixels the width
  // is not proportional to the scale and can stay the same over a small change of it: the
  // later passes shrink what still sticks out, by at least 3% each so that they get there.
  for (let pass = 0; pass < 8; pass++) {
    const width = span.getBoundingClientRect().width / unit;
    // Not laid out: hidden, or an environment without layout.
    if (!(width > 0) || !(available > 0)) return;
    if (pass > 0 && width <= available) return;
    const ratio = pass > 0 ? Math.min(available / width, 0.97) : available / width;
    // Rounded down, so that a fraction of a pixel is never clipped.
    const fit = Math.min(1, Math.floor(ratio * current * 1000) / 1000);
    if (fit === current) return;
    if (fit === 1) display.style.removeProperty("--_scale");
    else display.style.setProperty("--_scale", String(fit));
    current = fit;
  }
}

export interface CalculatorKeypadDisplayProps extends ComponentProps<"output"> {
  /**
   * Number of characters the display is taken to fit at its full size of 50 pt, where it
   * cannot be measured: when rendered on a server, and until the first layout. Longer text is
   * set smaller in proportion. In the browser the text is then measured and scaled to fit the
   * display exactly, whatever the font, and again when the display is resized or a font
   * finishes loading.
   * @default 7
   */
  fitLength?: number;
}

/**
 * The number above the keys: right-aligned thin digits. An `output` element, so a new value is
 * announced politely. Text too long for the display is scaled down to fit, as Calculator does.
 */
export function CalculatorKeypadDisplay({
  fitLength = 7,
  className,
  style,
  children,
  ...props
}: CalculatorKeypadDisplayProps) {
  const length =
    typeof children === "string" || typeof children === "number" ? `${children}`.length : 0;
  const scale = length > fitLength && fitLength > 0 ? fitLength / length : 1;
  const text = useRef<HTMLSpanElement>(null);

  // The estimate above counts characters; a digit's width depends on the font. Before the
  // browser paints, measure the text and set the scale at which it fills the display at most.
  useLayoutEffect(() => fitDisplayText(text.current));

  // The width of the same text also changes without a render: when the display is resized,
  // and when a font that was still loading replaces its fallback.
  useEffect(() => {
    const span = text.current;
    const display = span?.parentElement;
    if (!span || !display) return;
    const refit = () => fitDisplayText(span);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(refit);
    observer?.observe(display);
    const fonts = document.fonts as FontFaceSet | undefined; // absent in jsdom
    fonts?.addEventListener("loadingdone", refit);
    return () => {
      observer?.disconnect();
      fonts?.removeEventListener("loadingdone", refit);
    };
  }, []);
  return (
    <output
      className={cn("mac-calculator-keypad-display", className)}
      style={scale === 1 ? style : ({ "--_scale": scale, ...style } as CSSProperties)}
      {...props}
    >
      <span ref={text} className="mac-calculator-keypad-display-text">
        {children}
      </span>
    </output>
  );
}

export interface CalculatorKeypadKeyProps extends Omit<BaseButton.Props, "ref"> {
  /**
   * The key's colour role: `"digit"` is the lighter grey of the number keys, `"function"` the
   * darker grey of the top row (clear, negate, percent) and `"operator"` the orange column.
   * @default "digit"
   */
  variant?: "digit" | "function" | "operator";
  /**
   * Draw a symbol instead of text. The key is then named after the symbol ("Add", "Divide",
   * "Negate"…) unless it has an `aria-label`; children are ignored.
   */
  glyph?: CalculatorKeypadGlyph;
  /**
   * Number of grid columns the key covers; the `0` key of the basic calculator covers 2.
   * @default 1
   */
  span?: number;
  /**
   * Marks an operator that is waiting for its second number: a thin darker outline, and
   * `aria-pressed`. Leave it unset on keys that are never armed.
   */
  armed?: boolean;
  /** Ref to the rendered button. */
  ref?: Ref<HTMLElement>;
}

/**
 * One key of the keypad: a flat, borderless button with a text label or a drawn symbol.
 *
 * Built on Base UI's Button, so it also accepts `disabled`, `render` and every native button
 * attribute.
 */
export function CalculatorKeypadKey({
  variant = "digit",
  glyph,
  span = 1,
  armed,
  className,
  style,
  children,
  ...props
}: CalculatorKeypadKeyProps) {
  // Base UI's `style` is an object or a function of the button's state; keep either form.
  const column: CSSProperties = { gridColumnEnd: `span ${span}` };
  const spanned: CalculatorKeypadKeyProps["style"] =
    span === 1
      ? style
      : typeof style === "function"
        ? (state) => ({ ...column, ...style(state) })
        : { ...column, ...style };
  return (
    <BaseButton
      data-variant={variant}
      data-glyph={glyph}
      data-armed={armed ? "" : undefined}
      aria-pressed={armed}
      aria-label={glyph ? GLYPHS[glyph].name : undefined}
      className={withClassName("mac-calculator-keypad-key", className)}
      style={spanned}
      {...props}
    >
      {glyph ? (
        <svg
          className="mac-calculator-keypad-glyph"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path d={GLYPHS[glyph].path} />
          {glyph === "divide" ? (
            <>
              <circle className="mac-calculator-keypad-glyph-dot" cx="8" cy="2.75" r="1.5" />
              <circle className="mac-calculator-keypad-glyph-dot" cx="8" cy="12.75" r="1.5" />
            </>
          ) : null}
        </svg>
      ) : (
        <span className="mac-calculator-keypad-label">{children}</span>
      )}
    </BaseButton>
  );
}
