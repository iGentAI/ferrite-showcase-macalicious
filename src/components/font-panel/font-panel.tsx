"use client";

import { type MouseEvent, type ReactNode, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import type { FontFamily } from "../../lib/font-families";
import type { RichTextFormat } from "../../lib/rich-text";
import { BorderedList, BorderedListRow, BorderedListRows } from "../bordered-list";
import { ColorWell } from "../color-well";
import { PopUpButton, PopUpButtonItem } from "../pop-up-button";
import { SearchField } from "../search-field";
import { TextField } from "../text-field";
import { TitleBar } from "../title-bar";
import { Window, WindowBody, type WindowProps } from "../window";
import { WindowControls } from "../window-controls";
import "./font-panel.css";

/** What the panel changes: a family, a typeface (bold and italic), a size, the effects. */
export type FontPanelChange = Partial<
  Pick<
    RichTextFormat,
    "family" | "bold" | "italic" | "size" | "underline" | "strikethrough" | "color"
  >
>;

/** A family the panel lists dimmed, and why: the page says, as in "not installed on this computer". */
export interface DimmedFamily {
  /** The family's name, as `families` gives it. */
  name: string;
  /** Why it cannot be chosen; the note under the lists says each reason once. */
  reason: string;
}

export interface FontPanelProps
  extends Omit<WindowProps, "defaultValue" | "onChange" | "variant" | "fullScreen" | "title"> {
  /**
   * The format of the text the panel acts on, where the insertion point is: the panel selects
   * its family, typeface and size, and shows its underline, strikethrough and colour.
   * @default Helvetica Regular 12, black, no effects
   */
  value?: Partial<RichTextFormat>;
  /**
   * Called with what a control of the panel changed: a family chosen in the list, a typeface
   * (as `bold` and `italic`), a size chosen or typed, the underline, the strikethrough or the
   * text colour. Apply it to the selection, for example with `applyRichTextFormat`.
   */
  onFontChange?: (change: FontPanelChange) => void;
  /**
   * The families the panel lists, in its order: `FONT_FAMILIES` of `macalicious/lib/rich-text`
   * for the families that come with Catalina, or a list of your own. Given by the page, so that
   * a page that lists other families does not load those.
   */
  families: readonly FontFamily[];
  /**
   * The families of `families` to dim, each with its reason: they cannot be chosen, and a note
   * under the lists says why. A page that lists families it does not serve itself (the
   * system's, as `FONT_FAMILIES` names them) measures which of them the browser has a font for
   * and dims the others, so that no family is offered whose text would show in another font. The
   * panel measures nothing itself.
   * @default []
   */
  dimmedFamilies?: readonly DimmedFamily[];
  /**
   * The panel's title.
   * @default "Fonts"
   */
  title?: ReactNode;
  /**
   * The window controls. Pass `null` for none.
   * @default the usual three; the close button calls `onClose`
   */
  controls?: ReactNode;
  /** Called when the close button is activated. */
  onClose?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Frame width: a number of points or any CSS length.
   * @default 444
   */
  width?: number | string;
}

/** The size list of the panel, in points: AppKit's. */
const SIZES = [9, 10, 11, 12, 13, 14, 18, 24, 36, 48, 64, 72, 96, 144, 288];
/** The first collection, which holds every family. */
const ALL = "All Fonts";

/** A typed size in points, or `undefined` when the text is not one. */
const parseSize = (text: string) => {
  const size = Number(text.trim());
  return Number.isFinite(size) && size > 0 && size <= 999 ? size : undefined;
};

/** No family is dimmed. */
const NONE: readonly DimmedFamily[] = [];

/**
 * The Fonts panel (NSFontPanel): a utility window that sets the font of the selected text. A
 * row of effects (underline, strikethrough and the text colour) sits over four columns:
 * Collection, Family, Typeface and Size, with the size field above its list, and a search
 * field under them that filters the families.
 *
 * It is a `Window` of the panel kind and takes its props. It holds no font of its own: `value`
 * is the format of the selection, and every change is reported to `onFontChange`, which
 * applies it. Choosing a collection only filters the families.
 */
export function FontPanel({
  value,
  onFontChange,
  families,
  dimmedFamilies = NONE,
  title = "Fonts",
  controls,
  onClose,
  width = 444,
  className,
  "aria-labelledby": labelledBy,
  ...props
}: FontPanelProps) {
  const [collection, setCollection] = useState(ALL);
  const [query, setQuery] = useState("");
  // The families the page dims, by name, and its reasons, each once (`dimmedFamilies`).
  const missing = new Set(dimmedFamilies.map((each) => each.name));
  const reasons = [...new Set(dimmedFamilies.map((each) => each.reason))];
  // What is typed in the size field, until Return or leaving the field applies it. The ref says
  // it at once: applying moves the focus back to the text, and the blur that follows must not
  // apply the same draft a second time.
  const [draft, setDraftState] = useState<string | null>(null);
  const drafted = useRef<string | null>(null);
  const setDraft = (next: string | null) => {
    drafted.current = next;
    setDraftState(next);
  };

  const current = {
    family: value?.family ?? "Helvetica",
    bold: value?.bold ?? false,
    italic: value?.italic ?? false,
    size: value?.size ?? 12,
    underline: value?.underline ?? false,
    strikethrough: value?.strikethrough ?? false,
    color: value?.color ?? "#000000",
  };
  // The collections are those the families name, after All Fonts.
  const collections = [ALL, ...new Set(families.flatMap((each) => each.collections))].sort(
    (a, b) => (a === ALL ? -1 : b === ALL ? 1 : a.localeCompare(b)),
  );
  const wanted = query.trim().toLowerCase();
  const shown = families.filter(
    (each) =>
      (collection === ALL || each.collections.includes(collection)) &&
      (wanted === "" || each.name.toLowerCase().includes(wanted)),
  );
  const lower = current.family.toLowerCase();
  const family = families.find((each) => each.name.toLowerCase() === lower);
  const typeface = family?.typefaces.find(
    (face) => face.bold === current.bold && face.italic === current.italic,
  );
  const size = Number.isInteger(current.size) ? String(current.size) : current.size.toFixed(1);
  const commitSize = (text: string | null) => {
    if (text === null) return;
    setDraft(null);
    const next = parseSize(text);
    if (next !== undefined && next !== current.size) onFontChange?.({ size: next });
  };

  return (
    <Window
      variant="panel"
      width={width}
      className={cn("mac-font-panel", className)}
      {...(labelledBy ? { "aria-labelledby": labelledBy } : null)}
      {...props}
    >
      <TitleBar
        title={title}
        controls={
          controls !== undefined ? (
            controls
          ) : (
            <WindowControls
              onClose={onClose}
              minimizeDisabled
              zoomDisabled
              title="A panel closes; it does not minimize or go full screen"
            />
          )
        }
      />
      <WindowBody className="mac-font-panel-body">
        <fieldset className="mac-font-panel-effects" aria-label="Text effects">
          <PopUpButton
            size="small"
            aria-label="Text underline"
            value={current.underline ? "single" : "none"}
            onValueChange={(next) => onFontChange?.({ underline: next === "single" })}
            className="mac-font-panel-effect"
          >
            <PopUpButtonItem value="none">None</PopUpButtonItem>
            <PopUpButtonItem value="single">Single</PopUpButtonItem>
          </PopUpButton>
          <PopUpButton
            size="small"
            aria-label="Text strikethrough"
            value={current.strikethrough ? "single" : "none"}
            onValueChange={(next) => onFontChange?.({ strikethrough: next === "single" })}
            className="mac-font-panel-effect"
          >
            <PopUpButtonItem value="none">None</PopUpButtonItem>
            <PopUpButtonItem value="single">Single</PopUpButtonItem>
          </PopUpButton>
          <ColorWell
            variant="toolbar"
            aria-label="Text color"
            value={current.color}
            onValueChange={(color) => onFontChange?.({ color })}
          />
        </fieldset>
        <div className="mac-font-panel-columns">
          <span className="mac-font-panel-heading">Collection</span>
          <span className="mac-font-panel-heading">Family</span>
          <span className="mac-font-panel-heading">Typeface</span>
          <span className="mac-font-panel-heading">Size</span>
          <BorderedList className="mac-font-panel-list">
            <BorderedListRows
              className="mac-font-panel-rows"
              aria-label="Collection"
              rowHeight={17}
              value={[collection]}
              onValueChange={(next) => next[0] && setCollection(next[0])}
            >
              {collections.map((name) => (
                <BorderedListRow
                  key={name}
                  value={name}
                  title={name}
                  className="mac-font-panel-row"
                />
              ))}
            </BorderedListRows>
          </BorderedList>
          <BorderedList className="mac-font-panel-list">
            <BorderedListRows
              className="mac-font-panel-rows"
              aria-label="Family"
              rowHeight={17}
              value={family ? [family.name] : []}
              onValueChange={(next) =>
                next[0] && !missing.has(next[0]) && onFontChange?.({ family: next[0] })
              }
            >
              {shown.map((each) => (
                <BorderedListRow
                  key={each.name}
                  value={each.name}
                  title={each.name}
                  disabled={missing.has(each.name)}
                  className="mac-font-panel-row"
                />
              ))}
            </BorderedListRows>
          </BorderedList>
          <BorderedList className="mac-font-panel-list">
            <BorderedListRows
              className="mac-font-panel-rows"
              aria-label="Typeface"
              rowHeight={17}
              value={typeface ? [typeface.name] : []}
              onValueChange={(next) => {
                const face = family?.typefaces.find((each) => each.name === next[0]);
                if (face) onFontChange?.({ bold: face.bold, italic: face.italic });
              }}
            >
              {(family?.typefaces ?? []).map((face) => (
                <BorderedListRow
                  key={face.name}
                  value={face.name}
                  title={face.name}
                  className="mac-font-panel-row"
                />
              ))}
            </BorderedListRows>
          </BorderedList>
          <div className="mac-font-panel-size">
            <TextField
              size="small"
              aria-label="Font size"
              inputMode="decimal"
              value={draft ?? size}
              onValueChange={setDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitSize(drafted.current);
                else if (event.key === "Escape") setDraft(null);
              }}
              onBlur={() => commitSize(drafted.current)}
            />
            <BorderedList className="mac-font-panel-list">
              <BorderedListRows
                className="mac-font-panel-rows"
                aria-label="Size"
                rowHeight={17}
                value={[size]}
                onValueChange={(next) => next[0] && commitSize(next[0])}
              >
                {SIZES.map((each) => (
                  <BorderedListRow
                    key={each}
                    value={String(each)}
                    title={String(each)}
                    className="mac-font-panel-row"
                  />
                ))}
              </BorderedListRows>
            </BorderedList>
          </div>
        </div>
        <SearchField
          size="small"
          aria-label="Search fonts"
          value={query}
          onValueChange={setQuery}
          className="mac-font-panel-search"
        />
        {reasons.length > 0 ? (
          <p className="mac-font-panel-note" role="note">
            {reasons.join(" ")}
          </p>
        ) : null}
      </WindowBody>
    </Window>
  );
}
