/** The units Adjust Size and the Inspector's Crop tab write a length in. */
export type SizeUnit = "pixels" | "percent" | "inches" | "cm" | "mm" | "points";

export const SIZE_UNITS: readonly { value: SizeUnit; label: string }[] = [
  { value: "pixels", label: "pixels" },
  { value: "percent", label: "percent" },
  { value: "inches", label: "inches" },
  { value: "cm", label: "cm" },
  { value: "mm", label: "mm" },
  { value: "points", label: "points" },
];

const PER_INCH: Partial<Record<SizeUnit, number>> = { inches: 1, cm: 2.54, mm: 25.4, points: 72 };

/** `value` in `unit` as pixels, at `dpi` pixels to the inch, of a length `whole` pixels at 100%. */
export function toPixels(value: number, unit: SizeUnit, dpi: number, whole: number): number {
  if (unit === "pixels") return value;
  if (unit === "percent") return (value / 100) * whole;
  return (value / (PER_INCH[unit] ?? 1)) * dpi;
}

/** `pixels` written in `unit`, as a field shows it: whole pixels, otherwise to two places. */
export function fromPixels(pixels: number, unit: SizeUnit, dpi: number, whole: number): string {
  if (unit === "pixels") return String(Math.round(pixels));
  const value =
    unit === "percent" ? (pixels / whole) * 100 : (pixels / dpi) * (PER_INCH[unit] ?? 1);
  return String(Math.round(value * 100) / 100);
}
