"use client";

import { type ComponentProps, useState } from "react";
import { cn } from "../../lib/cn";
import { hexToHsva, hsvaToHex, hsvToRgb, rgbToHsv, useColorValue } from "../../lib/color-value";
import { useControlled } from "../../lib/use-controlled";
import { PopUpButton, PopUpButtonItem } from "../pop-up-button";
import { Slider } from "../slider";
import { TextField } from "../text-field";
import "./color-sliders.css";

/** The colour models of the sliders picker. */
export type ColorSlidersModel = "gray" | "rgb" | "hsb";

/* Each model: its name in the pop-up button, then each slider's name and maximum. */
const MODELS: Record<ColorSlidersModel, [string, [string, number][]]> = {
  gray: ["Gray Scale Slider", [["Brightness", 100]]],
  rgb: [
    "RGB Sliders",
    [
      ["Red", 255],
      ["Green", 255],
      ["Blue", 255],
    ],
  ],
  hsb: [
    "HSB Sliders",
    [
      ["Hue", 360],
      ["Saturation", 100],
      ["Brightness", 100],
    ],
  ],
};

export interface ColorSlidersChannelProps extends Omit<ComponentProps<"div">, "onChange"> {
  /** The channel's name: the row's label, and the accessible name of its slider. */
  name: string;
  /** The highest value; the lowest is 0. */
  max: number;
  /** The value. The row is always controlled. */
  value: number;
  /** Called with the new value, from the slider or from the number field. */
  onValueChange: (value: number) => void;
}

/**
 * One row of the sliders picker: a name, a small slider from 0 to `max` and a number field
 * that shows the same value, rounded, and takes a typed one. The Colors panel uses it for its
 * opacity row.
 */
export function ColorSlidersChannel({
  name,
  max,
  value,
  onValueChange,
  className,
  ...props
}: ColorSlidersChannelProps) {
  const shown = Math.round(value);
  return (
    <div className={cn("mac-color-sliders-channel", className)} {...props}>
      <span className="mac-color-sliders-name">{name}</span>
      <Slider
        size="small"
        aria-label={name}
        max={max}
        value={shown}
        onValueChange={onValueChange}
      />
      <TextField
        size="small"
        aria-label={`${name} value`}
        inputMode="numeric"
        value={String(shown)}
        onValueChange={(text) => {
          // Whole numbers in the range only: nothing else could be shown as it was typed.
          const n = Number(text);
          if (/^\d*$/.test(text) && n <= max) onValueChange(n);
        }}
      />
    </div>
  );
}

export interface ColorSlidersProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children"> {
  /** The colour, when controlled, as `#rrggbb` or `#rrggbbaa`. Use it with `onValueChange`. */
  value?: string;
  /**
   * The colour the picker starts with, when uncontrolled.
   * @default "#000000"
   */
  defaultValue?: string;
  /** Called with the new colour, as lower-case `#rrggbb` (`#rrggbbaa` when it is not opaque). */
  onValueChange?: (value: string) => void;
  /** The colour model whose sliders are shown, when controlled. Use it with `onModelChange`. */
  model?: ColorSlidersModel;
  /**
   * The colour model shown at first, when uncontrolled.
   * @default "rgb"
   */
  defaultModel?: ColorSlidersModel;
  /** Called with the colour model the user chose in the pop-up button. */
  onModelChange?: (model: ColorSlidersModel) => void;
}

/**
 * The sliders picker of the Colors panel (NSColorPanel's colour sliders): a pop-up button that
 * chooses a colour model (grey scale, RGB or HSB), one slider with a number field for each of
 * its components, and a field for the colour as six hexadecimal digits.
 *
 * It is built from the library's `PopUpButton`, `Slider` and `TextField`, and takes every
 * `<div>` prop. The opacity of the value it is given is kept.
 */
export function ColorSliders({
  value,
  defaultValue = "#000000",
  onValueChange,
  model,
  defaultModel = "rgb",
  onModelChange,
  className,
  ...props
}: ColorSlidersProps) {
  const [color, setColor] = useColorValue(value, defaultValue, onValueChange);
  const [shown, setShown] = useControlled(model, defaultModel, onModelChange);
  const [draft, setDraft] = useState<string | null>(null);
  const [h, s, v, a] = color;
  const values =
    shown === "rgb"
      ? hsvToRgb(h, s, v).map((n) => n * 255)
      : shown === "hsb"
        ? [h, s * 100, v * 100]
        : [v * 100];
  return (
    <div className={cn("mac-color-sliders", className)} {...props}>
      <PopUpButton
        size="small"
        aria-label="Color model"
        value={shown}
        onValueChange={(next) => next && setShown(next)}
      >
        {(Object.keys(MODELS) as ColorSlidersModel[]).map((id) => (
          <PopUpButtonItem key={id} value={id}>
            {MODELS[id][0]}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
      {MODELS[shown][1].map(([name, max], index) => (
        <ColorSlidersChannel
          key={name}
          name={name}
          max={max}
          value={values[index] as number}
          onValueChange={(n) => {
            const next = values.map((old, i) => (i === index ? n : old)) as [
              number,
              number,
              number,
            ];
            setColor(
              shown === "rgb"
                ? [...rgbToHsv(next[0] / 255, next[1] / 255, next[2] / 255), a]
                : shown === "hsb"
                  ? [next[0], next[1] / 100, next[2] / 100, a]
                  : [h, 0, next[0] / 100, a],
            );
          }}
        />
      ))}
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the text field renders the labelled input */}
      <label className="mac-color-sliders-hex">
        Hex Color #
        <TextField
          size="small"
          maxLength={6}
          spellCheck={false}
          value={draft ?? hsvaToHex([h, s, v, 1]).slice(1).toUpperCase()}
          onValueChange={(text) => {
            // The field shows what is typed until it is left; six digits are a colour.
            setDraft(text);
            if (/^[0-9a-f]{6}$/i.test(text)) {
              const [nh, ns, nv] = hexToHsva(text);
              setColor([nh, ns, nv, a]);
            }
          }}
          onBlur={() => setDraft(null)}
        />
      </label>
    </div>
  );
}
