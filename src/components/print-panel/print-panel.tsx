"use client";

import { type ComponentProps, type ReactNode, useEffect, useId, useState } from "react";
import { useControlled } from "../../lib/use-controlled";
import { BevelButton, BevelButtonGroup } from "../bevel-button";
import { Checkbox } from "../checkbox";
import { DefaultButton } from "../default-button";
import { HelpButton } from "../help-button";
import { PopUpButton, PopUpButtonItem, PopUpButtonSeparator } from "../pop-up-button";
import { PullDownButton } from "../pull-down-button";
import { PushButton } from "../push-button";
import { RadioButton, RadioGroup } from "../radio-button";
import { Segment, SegmentedControl } from "../segmented-control";
import { Separator } from "../separator";
import { TextField } from "../text-field";
import "./print-panel.tokens.css";
import "./print-panel.css";

/** What the panel holds: every choice the form shows, as plain data. */
export interface PrintPanelSettings {
  /** `value` of the chosen printer. */
  printer: string;
  /** `value` of the chosen preset. */
  preset: string;
  /** Number of copies, at least 1. */
  copies: number;
  /** Whether both sides of the paper are printed. */
  twoSided: boolean;
  /** Every page, or the pages `from` to `to`. */
  pages: "all" | "range";
  /** First page of the range. */
  from: number;
  /** Last page of the range. */
  to: number;
  /** `value` of the chosen paper size. */
  paperSize: string;
  /** Direction of the paper. */
  orientation: "portrait" | "landscape";
  /** `value` of the options pane that is shown. */
  pane: string;
}

/** One item of a pop-up button of the panel: a printer or a preset. */
export interface PrintPanelOption {
  /** What `PrintPanelSettings` holds while the item is chosen. Unique in its list. */
  value: string;
  /** The item's title, in the menu and in the button. */
  label: ReactNode;
  /** Draws a separator line above the item in the menu. */
  separatorBefore?: boolean;
}

/** A paper size: an item of the Paper Size pop-up button. */
export interface PrintPanelPaperSize extends PrintPanelOption {
  /** The text after the pop-up button while the size is chosen: "8.50 by 11.00 inches". */
  description?: ReactNode;
  /**
   * Width of the upright sheet divided by its height, which shapes the preview page. US Letter
   * (8.5 / 11) when left out.
   */
  aspectRatio?: number;
}

/** An options pane: an item of the pane pop-up button, and what is shown under it. */
export interface PrintPanelPane extends PrintPanelOption {
  /** The pane's controls, the application's own: a few checkboxes, a small form. */
  content?: ReactNode;
}

/**
 * The panel's own texts, in English: the keys of the `labels` prop. "Print" is both the
 * default button's title and the panel's accessible name; "of" stands between the page and
 * the page count; "Portrait", "Landscape", "Options" (the pane pop-up button), "Preview",
 * the four page buttons and "Help" are accessible names only.
 */
export type PrintPanelText =
  | "Print"
  | "Printer:"
  | "Presets:"
  | "Copies:"
  | "Two-Sided"
  | "Pages:"
  | "All"
  | "From:"
  | "to:"
  | "Paper Size:"
  | "Orientation:"
  | "Portrait"
  | "Landscape"
  | "Options"
  | "Preview"
  | "First page"
  | "Previous page"
  | "Next page"
  | "Last page"
  | "of"
  | "Help"
  | "PDF"
  | "Show Details"
  | "Hide Details"
  | "Cancel";

export interface PrintPanelProps extends Omit<ComponentProps<"div">, "children"> {
  /** The settings, when controlled. Use it with `onSettingsChange`. */
  settings?: PrintPanelSettings;
  /**
   * The settings at first, when uncontrolled. Whatever is left out starts as one copy, one
   * side, all pages, upright paper and the first item of each list.
   */
  defaultSettings?: Partial<PrintPanelSettings>;
  /** Called with the complete new settings whenever a control of the form changes one. */
  onSettingsChange?: (settings: PrintPanelSettings) => void;
  /**
   * The items of the Printer pop-up button.
   * @default []
   */
  printers?: readonly PrintPanelOption[];
  /**
   * The items of the Presets pop-up button.
   * @default []
   */
  presets?: readonly PrintPanelOption[];
  /**
   * The items of the Paper Size pop-up button. The chosen one's `description` is shown after
   * the button and its `aspectRatio` shapes the preview page.
   * @default []
   */
  paperSizes?: readonly PrintPanelPaperSize[];
  /**
   * The option panes of the detailed form: the items of the pop-up button in the separator
   * line, each with the `content` shown under it while it is chosen. An application lists its
   * own pane first. Every pane stays mounted, hidden while another is chosen or the simple
   * form is shown, so its controls keep their state. Without panes the line and the pop-up
   * button are left out.
   * @default []
   */
  panes?: readonly PrintPanelPane[];
  /**
   * What is drawn on the preview page: a copy of the current page of the document, laid out
   * for a page 301 pt long. The page is white in both appearances, has the chosen paper's
   * proportions and turns with the orientation; its content is clipped to it and is rendered
   * in the light appearance. It is announced as one image, so it holds nothing to operate.
   */
  preview?: ReactNode;
  /**
   * Number of pages of the document, at least 1, for the text and the buttons under the
   * preview. When it falls below the page shown, the last page is shown and reported.
   * @default 1
   */
  pageCount?: number;
  /** The page shown in the preview, from 1, when controlled. Use it with `onPageChange`. */
  page?: number;
  /**
   * The page shown in the preview at first, when uncontrolled.
   * @default 1
   */
  defaultPage?: number;
  /** Called with the new page when one of the four buttons under the preview is activated. */
  onPageChange?: (page: number) => void;
  /** Whether the detailed form is shown, when controlled. Use it with `onDetailedChange`. */
  detailed?: boolean;
  /**
   * Whether the detailed form is shown at first, when uncontrolled: Paper Size, Orientation
   * and the option panes as well, and the preview at its full size. AppKit starts with the
   * simple form.
   * @default false
   */
  defaultDetailed?: boolean;
  /** Called when the Show Details or Hide Details button is activated. */
  onDetailedChange?: (detailed: boolean) => void;
  /**
   * The menu of the PDF pull-down button: `MenuItem` and `MenuSeparator` elements from
   * `macalicious/menu-item`. Without it the button is left out.
   */
  pdfMenu?: ReactNode;
  /** Called when the help button is activated. */
  onHelp?: () => void;
  /** Called when Cancel is activated, with the pointer or with Escape. */
  onCancel?: () => void;
  /** Called with the settings when Print is activated, with the pointer or with Return. */
  onPrint?: (settings: PrintPanelSettings) => void;
  /**
   * Disables the Print button, and with it the Return key: while no printer is available.
   * @default false
   */
  printDisabled?: boolean;
  /**
   * Translations of the panel's own texts, by their English wording:
   * `{ "Printer:": "Drucker:", Print: "Drucken" }`. What is left out stays English.
   */
  labels?: Partial<Record<PrintPanelText, string>>;
}

/* Glyphs drawn for this library, sized and stroked by the stylesheet. The page chevrons point
   back; the stylesheet mirrors the forward ones. They are 1.25 pt strokes with 4 pt arms in
   whole-point boxes, 12 x 9 for a pair and 6 x 9 for one, placed as the Print sheet has them:
   the apex 12 pt (pair) and 14 pt (single) from the outer edge of a 33 pt segment. */
const PAIR = "M5.53.5l-4 4 4 4m6-8-4 4 4 4";
const SINGLE = "M4.53.5l-4 4 4 4";

/* The orientation pictogram, a stand-in for Apple's: an arrow for the direction the paper
   leaves the printer and a page with a folded corner, then a figure (a head and a line)
   that stands on the page or lies on it. */
const PAGE = "M4 23V3.5M1 7l3-3.5L7 7m4.5-3.5h9l5 5v14h-14zm9 0v5h5";

const glyph = (d: string) => (
  <svg className="mac-print-panel-glyph" aria-hidden="true">
    <path d={d} />
  </svg>
);

/* The panel is a `group` named "Print" with no background, frame or margin of its own: it goes
   in a `SheetPopup` attached to the document's window, or in the body of a `Window`. The lists
   come in through props, the form's state is one `settings` object, and Print and Cancel are
   reported; Return and Escape are their key equivalents in the enclosing sheet, dialog or
   window. The description below is one line because the build keeps it, and the size budget
   counts it. */
/** A Print dialog's content. */
export function PrintPanel({
  settings: settingsProp,
  defaultSettings,
  onSettingsChange,
  printers,
  presets,
  paperSizes,
  panes,
  preview,
  pageCount = 1,
  page: pageProp,
  defaultPage = 1,
  onPageChange,
  detailed: detailedProp,
  defaultDetailed = false,
  onDetailedChange,
  pdfMenu,
  onHelp,
  onCancel,
  onPrint,
  printDisabled = false,
  labels,
  className,
  ...props
}: PrintPanelProps) {
  const id = useId();
  const [settings, setSettings] = useControlled<PrintPanelSettings>(
    settingsProp,
    {
      // A setting that is one of a list starts as the list's first item.
      printer: printers?.[0]?.value ?? "",
      preset: presets?.[0]?.value ?? "",
      copies: 1,
      twoSided: false,
      pages: "all",
      from: 1,
      to: pageCount,
      paperSize: paperSizes?.[0]?.value ?? "",
      orientation: "portrait",
      pane: panes?.[0]?.value ?? "",
      ...defaultSettings,
    },
    onSettingsChange,
  );
  const [ownPage, setPage] = useControlled(pageProp, defaultPage, onPageChange);
  // A document that got shorter shows its last page, and says so once.
  const page = Math.min(ownPage, pageCount);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per change of the two numbers, whatever callback the render brings.
  useEffect(() => {
    if (ownPage > pageCount) setPage(pageCount);
  }, [ownPage, pageCount]);
  const [detailed, setDetailed] = useControlled(detailedProp, defaultDetailed, onDetailedChange);
  // The number field being edited and its text.
  const [draft, setDraft] = useState<[key: string, text: string]>();

  const t = (text: PrintPanelText) => labels?.[text] ?? text;
  const set = (change: Partial<PrintPanelSettings>) => setSettings({ ...settings, ...change });
  const paper = paperSizes?.find((size) => size.value === settings.paperSize);
  // The upright US Letter page is 233 x 301 pt; the simple form halves it in CSS.
  const short = Math.round(301 * (paper?.aspectRatio ?? 8.5 / 11));
  const landscape = settings.orientation === "landscape";

  // A row of the form: the label, whose id is the panel's id and the key of the setting the
  // row begins with, and the controls it names. The stylesheet tells the two apart, and the
  // rows, by their order.
  const row = (key: keyof PrintPanelSettings, label: PrintPanelText, controls: ReactNode) => (
    <div className="mac-print-panel-row">
      <span id={id + key}>{t(label)}</span>
      <div>{controls}</div>
    </div>
  );
  // A pop-up button for one setting, named by its row's label or by `name`.
  const popUp = (
    key: "printer" | "preset" | "paperSize" | "pane",
    options?: readonly PrintPanelOption[],
    name?: string,
  ) => (
    <PopUpButton
      aria-label={name}
      aria-labelledby={name ? undefined : id + key}
      className="mac-print-panel-pop-up"
      value={settings[key]}
      onValueChange={(value) => value != null && set({ [key]: value })}
    >
      {options?.flatMap((option) => [
        option.separatorBefore && <PopUpButtonSeparator key={`s${option.value}`} />,
        <PopUpButtonItem key={`i${option.value}`} value={option.value}>
          {option.label}
        </PopUpButtonItem>,
      ])}
    </PopUpButton>
  );
  // A text field for one setting that is a whole number of at least 1. What is typed is kept
  // while the field has the focus and reported whenever it is such a number; when the focus
  // leaves, the field shows the setting again, so an empty or mistyped entry is dropped, as a
  // number formatter does. Typing a page chooses the range, as in AppKit.
  const number = (key: "copies" | "from" | "to") => (
    <TextField
      aria-labelledby={id + key}
      inputMode="numeric"
      className="mac-print-panel-number"
      value={draft?.[0] === key ? draft[1] : settings[key]}
      onValueChange={(text) => {
        setDraft([key, text]);
        const value = +text;
        if (/^\d+$/.test(text) && value && Number.isSafeInteger(value)) {
          set({ [key]: value, pages: key === "copies" ? settings.pages : "range" });
        }
      }}
      onBlur={() => setDraft(undefined)}
    />
  );
  // A page button: a pair of chevrons or one. It is disabled where it leads nowhere.
  const pageButton = (label: PrintPanelText, chevrons: string, to: number) => (
    <Segment
      aria-label={t(label)}
      className="mac-print-panel-page-button"
      disabled={to < 1 || to > pageCount || to === page}
      onClick={() => setPage(to)}
    >
      {glyph(chevrons)}
    </Segment>
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a frame and a legend.
    <div
      role="group"
      aria-label={t("Print")}
      data-detailed={detailed || undefined}
      className={className ? `mac-print-panel ${className}` : "mac-print-panel"}
      {...props}
    >
      <div className="mac-print-panel-preview">
        {/* The paper is white in Dark Aqua too, so what is on it is drawn in Aqua. */}
        <div
          role="img"
          aria-label={t("Preview")}
          data-appearance="light"
          className="mac-print-panel-page"
          style={{ width: landscape ? 301 : short, height: landscape ? short : 301 }}
        >
          {preview}
        </div>
        <div className="mac-print-panel-navigation">
          <SegmentedControl trackingMode="momentary" size="mini" distribution="fit">
            {pageButton("First page", PAIR, 1)}
            {pageButton("Previous page", SINGLE, page - 1)}
          </SegmentedControl>
          <span aria-live="polite">
            {page} {t("of")} {pageCount}
          </span>
          <SegmentedControl trackingMode="momentary" size="mini" distribution="fit">
            {pageButton("Next page", SINGLE, page + 1)}
            {pageButton("Last page", PAIR, pageCount)}
          </SegmentedControl>
        </div>
      </div>

      <div className="mac-print-panel-form">
        {row("printer", "Printer:", popUp("printer", printers))}
        {row("preset", "Presets:", popUp("preset", presets))}
        {row(
          "copies",
          "Copies:",
          <>
            {number("copies")}
            <Checkbox checked={settings.twoSided} onCheckedChange={(twoSided) => set({ twoSided })}>
              {t("Two-Sided")}
            </Checkbox>
          </>,
        )}
        {row(
          "pages",
          "Pages:",
          <>
            <RadioGroup
              aria-labelledby={`${id}pages`}
              value={settings.pages}
              onValueChange={(pages) => set({ pages: pages as PrintPanelSettings["pages"] })}
            >
              <RadioButton value="all">{t("All")}</RadioButton>
              <RadioButton value="range">
                {/* Base UI gives an id to the radio's hidden input: the title carries this one. */}
                <span id={`${id}from`}>{t("From:")}</span>
              </RadioButton>
            </RadioGroup>
            {number("from")}
            <span id={`${id}to`}>{t("to:")}</span>
            {number("to")}
          </>,
        )}
        {detailed && (
          <>
            {row(
              "paperSize",
              "Paper Size:",
              <>
                {popUp("paperSize", paperSizes)}
                {paper?.description}
              </>,
            )}
            {row(
              "orientation",
              "Orientation:",
              <BevelButtonGroup
                aria-labelledby={`${id}orientation`}
                value={[settings.orientation]}
                // Clicking the button that is on leaves nothing on: one always is.
                onValueChange={([orientation]) =>
                  orientation &&
                  set({ orientation: orientation as PrintPanelSettings["orientation"] })
                }
              >
                <BevelButton value="portrait" aria-label={t("Portrait")}>
                  {glyph(`${PAGE}M17.5 9.5h2v2h-2zm1 4v6.5`)}
                </BevelButton>
                <BevelButton value="landscape" aria-label={t("Landscape")}>
                  {glyph(`${PAGE}M23 14h-2v2h2zm-4 1h-6.5`)}
                </BevelButton>
              </BevelButtonGroup>,
            )}
            {panes?.[0] && (
              // The stylesheet draws the line beside the pop-up button.
              <div className="mac-print-panel-pane-bar">{popUp("pane", panes, t("Options"))}</div>
            )}
          </>
        )}
        {/* The stylesheet finds a pane as the child of the form that has no class. */}
        {panes?.map((pane) => (
          <div key={pane.value} hidden={!detailed || pane.value !== settings.pane}>
            {pane.content}
          </div>
        ))}
      </div>

      {/* The stylesheet finds this line, and the buttons of the row under it, by their order. */}
      <Separator />
      <div className="mac-print-panel-actions">
        <HelpButton label={t("Help")} onClick={onHelp} />
        {pdfMenu != null && pdfMenu !== false && (
          <PullDownButton title={t("PDF")}>{pdfMenu}</PullDownButton>
        )}
        <PushButton onClick={() => setDetailed(!detailed)}>
          {t(detailed ? "Hide Details" : "Show Details")}
        </PushButton>
        <PushButton keyEquivalent={onCancel && "escape"} onClick={onCancel}>
          {t("Cancel")}
        </PushButton>
        <DefaultButton disabled={printDisabled} onClick={() => onPrint?.(settings)}>
          {t("Print")}
        </DefaultButton>
      </div>
    </div>
  );
}
