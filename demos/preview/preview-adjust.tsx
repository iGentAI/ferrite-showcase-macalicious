"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { InspectorPanel } from "macalicious/inspector-panel";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { SheetTitle } from "macalicious/sheet";
import { Slider } from "macalicious/slider";
import { TextField } from "macalicious/text-field";
import { useState } from "react";
import { type ColorAdjust, NO_ADJUST } from "./preview-color";
import { fromPixels, SIZE_UNITS, type SizeUnit, toPixels } from "./preview-units";

const SLIDERS: readonly { key: keyof ColorAdjust; label: string; min?: number }[] = [
  { key: "exposure", label: "Exposure" },
  { key: "contrast", label: "Contrast" },
  { key: "highlights", label: "Highlights" },
  { key: "shadows", label: "Shadows" },
  { key: "saturation", label: "Saturation" },
  { key: "temperature", label: "Temperature" },
  { key: "tint", label: "Tint" },
  { key: "sepia", label: "Sepia", min: 0 },
  { key: "sharpness", label: "Sharpness" },
];

/** Tools > Adjust Color: the picture's levels, and sliders that change it as they move. */
export function AdjustColorPanel({
  value,
  levels,
  onChange,
  onAuto,
  onClose,
}: {
  value: ColorAdjust;
  /** How much of the picture stands at each level of light, as `levelsOf` gives it. */
  levels: readonly number[];
  onChange: (next: ColorAdjust) => void;
  onAuto: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mac-preview-app-adjust">
      <InspectorPanel title="Adjust Color" onClose={onClose}>
        <div className="mac-preview-app-levels" role="img" aria-label="Levels of the picture">
          {levels.map((level, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a level is known by its place.
              key={index}
              className="mac-preview-app-level"
              style={{ height: `${level * 100}%` }}
            />
          ))}
        </div>
        <div className="mac-preview-app-adjust-sliders">
          {SLIDERS.map(({ key, label, min = -1 }) => (
            <div key={key} className="mac-preview-app-adjust-row">
              <Label>{label}:</Label>
              <Slider
                aria-label={label}
                min={min}
                max={1}
                step={0.01}
                value={value[key]}
                onValueChange={(next) => onChange({ ...value, [key]: next as number })}
              />
            </div>
          ))}
        </div>
        <div className="mac-preview-app-sheet-buttons">
          <PushButton onClick={onAuto}>Auto Levels</PushButton>
          <PushButton onClick={() => onChange(NO_ADJUST)}>Reset All</PushButton>
        </div>
      </InspectorPanel>
    </div>
  );
}

/** What the Fit into menu offers, as a Mac's does. */
const FITS: readonly (readonly [number, number])[] = [
  [320, 240],
  [640, 480],
  [800, 600],
  [1024, 768],
  [1280, 1024],
  [1600, 1200],
];
const LIMIT = 16384;
/** The dots per inch a picture is taken to have until it is given some. */
export const SCREEN_DPI = 72;

/** What Adjust Size changes of a picture. */
export interface PictureSize {
  /** The saved width as a share of the width the crop gives. */
  scale: number;
  /** How much the height goes beyond that share. */
  stretch: number;
  dpi: number;
}

const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/**
 * Adjust Size: fit it into a size, or give its width, height and resolution in the units chosen, in
 * proportion or not, with its pixels changed or (Resample image off) only their size on paper.
 */
export function AdjustSizeSheet({
  size,
  current,
  bytes,
  onResize,
  onCancel,
}: {
  /** The size in pixels the crop gives at 100%. */
  size: { width: number; height: number };
  current: PictureSize;
  /** What the file takes on the drive, from which what it will take is reckoned. */
  bytes: number;
  onResize: (next: PictureSize) => void;
  onCancel: () => void;
}) {
  const startWidth = size.width * current.scale;
  const startHeight = size.height * current.scale * current.stretch;
  const [unit, setUnit] = useState<SizeUnit>("pixels");
  const [dpi, setDpi] = useState(current.dpi);
  const [pixels, setPixels] = useState({ width: startWidth, height: startHeight });
  const [fields, setFields] = useState({
    width: String(Math.round(startWidth)),
    height: String(Math.round(startHeight)),
    dpi: String(current.dpi),
  });
  const [proportional, setProportional] = useState(true);
  const [resample, setResample] = useState(true);
  const show = (next: { width: number; height: number }, atUnit: SizeUnit, atDpi: number) => {
    setPixels(next);
    setFields({
      width: fromPixels(next.width, atUnit, atDpi, size.width),
      height: fromPixels(next.height, atUnit, atDpi, size.height),
      dpi: String(atDpi),
    });
  };
  const ratio = startHeight / startWidth;
  const typed = (side: "width" | "height", text: string) => {
    const value = Number(text);
    const whole = side === "width" ? size.width : size.height;
    const usable = Number.isFinite(value) && value > 0;
    if (!resample) {
      // The pixels stay: the length typed says how many there are to the inch.
      setFields((now) => ({ ...now, [side]: text }));
      if (!usable) return;
      const inches = toPixels(value, unit, 1, whole);
      const next = Math.round(pixels[side] / inches);
      if (next < 1) return;
      setDpi(next);
      setFields({
        width: side === "width" ? text : fromPixels(pixels.width, unit, next, size.width),
        height: side === "height" ? text : fromPixels(pixels.height, unit, next, size.height),
        dpi: String(next),
      });
      return;
    }
    if (!usable) {
      setFields((now) => ({ ...now, [side]: text }));
      return;
    }
    const pixel = toPixels(value, unit, dpi, whole);
    const next = { ...pixels, [side]: pixel };
    if (proportional) {
      if (side === "width") next.height = pixel * ratio;
      else next.width = pixel / ratio;
    }
    setPixels(next);
    setFields((now) => ({
      ...now,
      [side]: text,
      ...(proportional
        ? side === "width"
          ? { height: fromPixels(next.height, unit, dpi, size.height) }
          : { width: fromPixels(next.width, unit, dpi, size.width) }
        : {}),
    }));
  };
  const fitInto = (choice: string) => {
    const [wide, high] = choice === "actual" ? [size.width, size.height] : choice.split("x");
    const across = Number(wide);
    const down = Number(high);
    const share = Math.min(across / size.width, down / size.height);
    setResample(true);
    setProportional(true);
    show({ width: size.width * share, height: size.height * share }, unit, dpi);
  };
  const width = Math.round(pixels.width);
  const height = Math.round(pixels.height);
  const dpiTyped = Number(fields.dpi);
  const valid =
    width >= 1 &&
    width <= LIMIT &&
    height >= 1 &&
    height <= LIMIT &&
    dpi >= 1 &&
    dpi <= 10_000 &&
    Number.isFinite(dpiTyped) &&
    dpiTyped > 0;
  const was = startWidth * startHeight;
  const finish = () => {
    const scale = width / size.width;
    onResize({
      scale,
      // Rounding a proportional size to whole pixels does not make the picture any less so.
      stretch: proportional ? current.stretch : height / size.height / scale,
      dpi,
    });
  };
  return (
    <div className="mac-preview-app-sheet">
      <SheetTitle>Image Dimensions</SheetTitle>
      <div className="mac-preview-app-size">
        <Label>Fit into:</Label>
        <PopUpButton
          aria-label="Fit into"
          value="custom"
          onValueChange={(value) => value && value !== "custom" && fitInto(String(value))}
        >
          <PopUpButtonItem value="custom">Custom</PopUpButtonItem>
          {FITS.map(([wide, high]) => (
            <PopUpButtonItem key={wide} value={`${wide}x${high}`}>
              {wide} × {high} pixels
            </PopUpButtonItem>
          ))}
          <PopUpButtonItem value="actual">Actual Size</PopUpButtonItem>
        </PopUpButton>
        <Label>Width:</Label>
        <TextField
          aria-label="Width"
          inputMode="decimal"
          value={fields.width}
          onValueChange={(value) => typed("width", value)}
        />
        <Label>Height:</Label>
        <TextField
          aria-label="Height"
          inputMode="decimal"
          value={fields.height}
          onValueChange={(value) => typed("height", value)}
        />
        <Label>Units:</Label>
        <PopUpButton
          aria-label="Units"
          value={unit}
          onValueChange={(value) => {
            if (!value) return;
            const next = value as SizeUnit;
            setUnit(next);
            show(pixels, next, dpi);
          }}
        >
          {SIZE_UNITS.map((each) => (
            <PopUpButtonItem
              key={each.value}
              value={each.value}
              disabled={!resample && (each.value === "pixels" || each.value === "percent")}
            >
              {each.label}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
        <Label>Resolution:</Label>
        <TextField
          aria-label="Resolution"
          inputMode="numeric"
          value={fields.dpi}
          onValueChange={(value) => {
            const next = Number(value);
            if (Number.isFinite(next) && next > 0) {
              setDpi(next);
              if (!resample) {
                setFields({
                  width: fromPixels(pixels.width, unit, next, size.width),
                  height: fromPixels(pixels.height, unit, next, size.height),
                  dpi: value,
                });
                return;
              }
            }
            setFields((now) => ({ ...now, dpi: value }));
          }}
        />
      </div>
      <Checkbox
        checked={proportional}
        disabled={!resample}
        onCheckedChange={(next) => setProportional(next === true)}
      >
        Scale proportionally
      </Checkbox>
      <Checkbox
        checked={resample}
        onCheckedChange={(next) => {
          const on = next === true;
          setResample(on);
          if (on) return;
          setProportional(true);
          const physical = unit === "pixels" || unit === "percent" ? "inches" : unit;
          setUnit(physical);
          show({ width: startWidth, height: startHeight }, physical, dpi);
        }}
      >
        Resample image
      </Checkbox>
      <Label color="secondary" role="status">
        Resulting Size: {width} × {height} pixels, about{" "}
        {megabytes(bytes * ((width * height) / was))} (was {megabytes(bytes)})
      </Label>
      <div className="mac-preview-app-sheet-buttons">
        <PushButton keyEquivalent="escape" onClick={onCancel}>
          Cancel
        </PushButton>
        <DefaultButton disabled={!valid} onClick={finish}>
          OK
        </DefaultButton>
      </div>
    </div>
  );
}
