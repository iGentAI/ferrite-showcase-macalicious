"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { ImageButton } from "macalicious/image-button";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "macalicious/popover";
import type { CSSProperties } from "react";
import { useDesktopSetting } from "../desktop/desktop-personal";

/*
 * How a book's page looks: the text's size and face and the page's theme, the person's desktop
 * values, so they follow the account from browser to browser (`useDesktopSetting`). Without a
 * settings session (the tests, the documentation) they last as long as the page.
 */

export const BOOKS_SETTINGS = {
  size: "books.textSize",
  theme: "books.theme",
  face: "books.textFace",
  justify: "books.justify",
  autoNight: "books.autoNight",
  pageLayout: "books.pageLayout",
} as const;

/** View > Single Page, Two Pages and Scroll: how an open book lays out its text. */
export type BooksPageLayout = "single" | "two" | "scroll";
const readPageLayout = (stored: unknown): BooksPageLayout | undefined =>
  stored === "single" || stored === "two" || stored === "scroll" ? stored : undefined;

/** `auto`, what a person starts with, follows the appearance: white in Aqua, dark in Dark Aqua. */
export type BooksTheme = "auto" | "white" | "sepia" | "gray" | "night";
export const BOOKS_THEMES: readonly { id: Exclude<BooksTheme, "auto">; name: string }[] = [
  { id: "white", name: "White" },
  { id: "sepia", name: "Sepia" },
  { id: "gray", name: "Gray" },
  { id: "night", name: "Night" },
];

export type BooksFace = "original" | "georgia" | "palatino" | "times" | "san-francisco";
export const BOOKS_FACES: readonly { id: BooksFace; name: string }[] = [
  { id: "original", name: "Original" },
  { id: "georgia", name: "Georgia" },
  { id: "palatino", name: "Palatino" },
  { id: "times", name: "Times New Roman" },
  { id: "san-francisco", name: "San Francisco" },
];

/** The text sizes in points; Zoom In and Zoom Out step through them. */
export const BOOKS_TEXT_SIZES: readonly number[] = [13, 15, 17, 19, 21, 24, 28, 32];
export const BOOKS_TEXT_SIZE = 17;

const readSize = (stored: unknown) =>
  BOOKS_TEXT_SIZES.find((size) => size === stored) as number | undefined;
const readTheme = (stored: unknown) => BOOKS_THEMES.find(({ id }) => id === stored)?.id;
const readFace = (stored: unknown) => BOOKS_FACES.find(({ id }) => id === stored)?.id;
export const readBooksFlag = (stored: unknown) =>
  typeof stored === "boolean" ? stored : undefined;

export type BooksZoom = "in" | "out" | "actual";

export interface BooksAppearance {
  size: number;
  theme: BooksTheme;
  face: BooksFace;
  /** Books > Preferences: the page's lines run to both margins. */
  justify: boolean;
  /** Books > Preferences: a page with no theme chosen follows Dark Mode; off, it stays white. */
  autoNight: boolean;
  pageLayout: BooksPageLayout;
  setPageLayout: (layout: BooksPageLayout) => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoom: (change: BooksZoom) => void;
  setTheme: (theme: BooksTheme) => void;
  setFace: (face: BooksFace) => void;
}

export function useBooksAppearance(): BooksAppearance {
  const [size, setSize] = useDesktopSetting<number>(BOOKS_SETTINGS.size, readSize, BOOKS_TEXT_SIZE);
  const [theme, setTheme] = useDesktopSetting<BooksTheme>(BOOKS_SETTINGS.theme, readTheme, "auto");
  const [face, setFace] = useDesktopSetting<BooksFace>(BOOKS_SETTINGS.face, readFace, "original");
  const [justify] = useDesktopSetting(BOOKS_SETTINGS.justify, readBooksFlag, false);
  const [autoNight] = useDesktopSetting(BOOKS_SETTINGS.autoNight, readBooksFlag, true);
  const [pageLayout, setPageLayout] = useDesktopSetting<BooksPageLayout>(
    BOOKS_SETTINGS.pageLayout,
    readPageLayout,
    "single",
  );
  const step = BOOKS_TEXT_SIZES.indexOf(size);
  return {
    size,
    theme,
    face,
    justify,
    autoNight,
    pageLayout,
    setPageLayout,
    canZoomIn: step < BOOKS_TEXT_SIZES.length - 1,
    canZoomOut: step > 0,
    zoom: (change) => {
      if (change === "actual") setSize(BOOKS_TEXT_SIZE);
      else {
        const next = BOOKS_TEXT_SIZES[step + (change === "in" ? 1 : -1)];
        if (next !== undefined) setSize(next);
      }
    },
    setTheme,
    setFace,
  };
}

/** The attributes and the size a page takes from `appearance`. */
export const appearanceProps = ({
  size,
  theme,
  face,
  justify,
  autoNight,
  pageLayout,
}: BooksAppearance) => ({
  "data-books-layout": pageLayout,
  "data-books-theme": theme === "auto" ? (autoNight ? undefined : "white") : theme,
  "data-books-face": face,
  "data-books-justify": justify ? "" : undefined,
  style: { "--mac-books-text-size": `${size}px` } as CSSProperties,
});

export interface BooksAppearanceButtonProps {
  appearance: BooksAppearance;
  disabled?: boolean;
  /** Of the bar's button, as its other buttons have. */
  style?: CSSProperties;
}

/** The reader bar's Aa button and its popover: smaller or larger text, the themes, the faces. */
export function BooksAppearanceButton({ appearance, disabled, style }: BooksAppearanceButtonProps) {
  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        render={<ImageButton aria-label="Appearance" style={style} />}
      >
        <span className="mac-books-appearance-glyph">Aa</span>
      </PopoverTrigger>
      <PopoverPopup className="mac-books-appearance" side="bottom">
        <PopoverTitle>Appearance</PopoverTitle>
        {/* biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset */}
        <div className="mac-books-appearance-sizes" role="group" aria-label="Text size">
          <BorderlessButton
            aria-label="Smaller Text"
            disabled={!appearance.canZoomOut}
            onClick={() => appearance.zoom("out")}
          >
            <span className="mac-books-appearance-small">A</span>
          </BorderlessButton>
          <BorderlessButton
            aria-label="Larger Text"
            disabled={!appearance.canZoomIn}
            onClick={() => appearance.zoom("in")}
          >
            <span className="mac-books-appearance-large">A</span>
          </BorderlessButton>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset */}
        <div className="mac-books-appearance-themes" role="group" aria-label="Theme">
          {BOOKS_THEMES.map(({ id, name }) => (
            <BorderlessButton
              key={id}
              className="mac-books-appearance-theme"
              data-books-theme={id}
              aria-label={name}
              aria-pressed={appearance.theme === id}
              onClick={() => appearance.setTheme(id)}
            />
          ))}
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset */}
        <div className="mac-books-appearance-faces" role="group" aria-label="Font">
          {BOOKS_FACES.map(({ id, name }) => (
            <BorderlessButton
              key={id}
              className="mac-books-appearance-face"
              data-books-face={id}
              aria-pressed={appearance.face === id}
              onClick={() => appearance.setFace(id)}
            >
              {name}
            </BorderlessButton>
          ))}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
