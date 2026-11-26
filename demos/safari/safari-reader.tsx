"use client";

import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { SmartSearchFieldButton } from "macalicious/smart-search-field";

/** Reader's choices, kept with the person's settings: the sizes are points. */
export interface ReaderOptions {
  size: number;
  font: string;
  theme: "white" | "sepia" | "gray" | "night";
}

export const READER_OPTIONS: ReaderOptions = { size: 20, font: "system", theme: "white" };
const SIZES = [14, 17, 20, 24, 28, 34] as const;

export const READER_FONTS: Readonly<Record<string, { label: string; family?: string }>> = {
  system: { label: "San Francisco" },
  georgia: { label: "Georgia", family: "Georgia, serif" },
  palatino: { label: "Palatino", family: "Palatino, 'Palatino Linotype', serif" },
  times: { label: "Times", family: "'Times New Roman', Times, serif" },
  menlo: { label: "Menlo", family: "Menlo, Consolas, monospace" },
};

const THEMES = [
  { id: "white", label: "White" },
  { id: "sepia", label: "Sepia" },
  { id: "gray", label: "Gray" },
  { id: "night", label: "Night" },
] as const;

/** What was kept, when it is whole. */
export function readReaderOptions(stored: unknown): ReaderOptions | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { size, font, theme } = stored as Partial<ReaderOptions>;
  return typeof size === "number" &&
    (SIZES as readonly number[]).includes(size) &&
    typeof font === "string" &&
    font in READER_FONTS &&
    THEMES.some(({ id }) => id === theme)
    ? ({ size, font, theme } as ReaderOptions)
    : undefined;
}

/** The next size up or down, staying at the ends. */
export function stepSize(size: number, by: 1 | -1): number {
  const at = SIZES.indexOf(size as (typeof SIZES)[number]);
  return SIZES[Math.max(0, Math.min(SIZES.length - 1, at + by))] ?? size;
}

/** The address field's button in Reader: text size, typeface and background. */
export function SafariReaderOptions({
  value,
  onChange,
}: {
  value: ReaderOptions;
  onChange: (next: ReaderOptions) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={<SmartSearchFieldButton glyph="text-size" aria-label="Change Reader text size" />}
      />
      <PopoverPopup className="mac-safari-reader-options" side="bottom">
        <PopoverTitle>Reader</PopoverTitle>
        <div className="mac-safari-reader-row">
          <PushButton
            aria-label="Smaller"
            disabled={value.size === SIZES[0]}
            onClick={() => onChange({ ...value, size: stepSize(value.size, -1) })}
          >
            A
          </PushButton>
          <PushButton
            aria-label="Larger"
            disabled={value.size === SIZES.at(-1)}
            onClick={() => onChange({ ...value, size: stepSize(value.size, 1) })}
          >
            <span className="mac-safari-reader-larger">A</span>
          </PushButton>
        </div>
        <div className="mac-safari-reader-row">
          {THEMES.map(({ id, label }) => (
            <PushButton
              key={id}
              size="small"
              aria-pressed={value.theme === id}
              onClick={() => onChange({ ...value, theme: id })}
            >
              {label}
            </PushButton>
          ))}
        </div>
        <PopUpButton<string>
          aria-label="Typeface"
          value={value.font}
          onValueChange={(font) => {
            if (font) onChange({ ...value, font });
          }}
        >
          {Object.entries(READER_FONTS).map(([id, { label }]) => (
            <PopUpButtonItem key={id} value={id}>
              {label}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </PopoverPopup>
    </Popover>
  );
}
