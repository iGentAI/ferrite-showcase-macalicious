"use client";

import { DefaultButton } from "macalicious/default-button";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { SavePanelRow } from "macalicious/save-panel";
import { SheetActions, SheetTitle } from "macalicious/sheet";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TextField } from "macalicious/text-field";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { DesktopDragItem } from "../desktop/desktop-drag";
import { versionDate } from "../desktop/desktop-files";
import { linkAddress } from "../desktop/desktop-open-url";
import { FileShareItems } from "../desktop/desktop-share-link";
import { DriveSavePanel, type DriveSaveTarget } from "../finder/finder-file-dialogs";
import { FILE_FORMATS, LINES_PER_PAGE, type TextEditDocument } from "./textedit-data";
import { LINE_HEIGHT } from "./textedit-document";
import { PLAIN_ENCODINGS } from "./textedit-encodings";
import { fileNameFor, isHtmlName, nameInFormat, nameWithExtension } from "./textedit-files";
import { useAddsTxtExtension } from "./textedit-preferences";

/*
 * The parts of TextEdit that work on the person's drive, served by the desktop's Ferrite
 * application: the Save sheet's content on the drive with its File Format button, the Rename
 * sheet's content, the File menu's items, and printing the document (File > Export as PDF and
 * the Print sheet's Print), which the browser's own print dialog carries out.
 */

/** The Save sheet's File Format choices on the drive; each `extension` a rich text file held as HTML. */
const DRIVE_FORMATS = [
  ...FILE_FORMATS,
  {
    value: "rtfd",
    label: "Rich Text With Graphics Document (.rtfd)",
    format: "rich",
    extension: "rtfd",
  },
  { value: "html", label: "Web Page (.html)", format: "rich", extension: "html" },
  {
    value: "webarchive",
    label: "Web Archive Document (.webarchive)",
    format: "rich",
    extension: "webarchive",
  },
  { value: "docx", label: "Word 2007 Format (.docx)", format: "rich", extension: "docx" },
  { value: "odt", label: "OpenDocument Text (.odt)", format: "rich", extension: "odt" },
] as const;

/** The format of the File Format button's choice. */
const formatOf = (value: string): TextEditDocument["format"] =>
  DRIVE_FORMATS.find((entry) => entry.value === value)?.format ?? "rich";

/** The extension of a File Format choice held as HTML; none for Rich Text and Plain Text. */
const markupExtensionOf = (value: string) => {
  const entry = DRIVE_FORMATS.find((each) => each.value === value);
  return entry && "extension" in entry ? entry.extension : undefined;
};

/** The File Format choice a file's name stands for. */
const choiceOf = (name: string, format: TextEditDocument["format"]) => {
  if (format === "plain") return "txt";
  if (isHtmlName(name)) return "html";
  const extension = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase();
  return (
    DRIVE_FORMATS.find((each) => "extension" in each && each.extension === extension)?.value ??
    "rtf"
  );
};

/** `named` without the `.txt` it gained from `typed`: Preferences' Add ".txt" extension is off. */
const withoutAddedTxt = (named: string, typed: string) =>
  /\.txt$/i.test(typed.trim()) ? named : named.replace(/\.txt$/i, "");

/**
 * Rewrites the Save sheet's name field, as typing would, so that the shared Save dialog keeps
 * the name it shows (and asks about replacing a file of that name). `row` is an element of the
 * sheet's form; the name field is the form's first field.
 */
function setSheetName(row: HTMLElement | null, chosen: string, addTxt: boolean) {
  const input = nameField(row);
  if (!input) return;
  const format = formatOf(chosen);
  const extension = markupExtensionOf(chosen);
  const named = extension
    ? nameWithExtension(input.value, extension)
    : nameInFormat(input.value, format);
  writeName(input, format === "plain" && !addTxt ? withoutAddedTxt(named, input.value) : named);
}

/** The Save sheet's name field, found from an element of the sheet's form. */
const nameField = (row: HTMLElement | null) =>
  row
    ?.closest("form")
    ?.querySelector<HTMLInputElement>(".mac-save-panel-form .mac-save-panel-field input") ?? null;

/** Puts `next` in the name field, as typing would. */
function writeName(input: HTMLInputElement, next: string) {
  if (next === input.value) return;
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input) as HTMLInputElement,
    "value",
  )?.set;
  if (setter) setter.call(input, next);
  else input.value = next;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export interface TextEditDriveSaveProps {
  /** The document's name, with or without an extension. */
  name: string;
  /** The document's format, which the File Format button starts on. */
  format: TextEditDocument["format"];
  /** Called with where to save, the name carrying the chosen format's extension, and a plain text file's encoding. */
  onSave: (target: DriveSaveTarget, format: TextEditDocument["format"], encoding: string) => void;
  onCancel: () => void;
  /** The encoding the Plain Text Encoding button starts on. */
  encoding?: string;
}

/** The Save sheet's content on the drive: the shared Save dialog, File Format and Plain Text Encoding. */
export function TextEditDriveSave({
  name,
  format,
  onSave,
  onCancel,
  encoding = "utf-8",
}: TextEditDriveSaveProps) {
  const [chosen, setChosen] = useState<string>(choiceOf(name, format));
  const [chosenEncoding, setChosenEncoding] = useState(encoding);
  const label = useId();
  const encodingLabel = useId();
  const row = useRef<HTMLDivElement>(null);
  const addTxt = useAddsTxtExtension();
  const nameToSave = (typed: string, as: string) => {
    const extension = markupExtensionOf(as);
    if (extension) return nameWithExtension(typed, extension);
    const named = fileNameFor(typed, formatOf(as));
    return formatOf(as) === "plain" && !addTxt ? withoutAddedTxt(named, typed) : named;
  };
  return (
    <DriveSavePanel
      defaultName={nameToSave(name, chosen)}
      onCancel={onCancel}
      // A name without the format's extension gets it, as with "Hide extension" on a Mac, and a
      // document extension the format does not open as is replaced: plain text is never written
      // into an `.rtf` file, nor RTF into a `.txt` one. The dialog asks about replacing a file of
      // the name saved under.
      nameToSave={(typed) => nameToSave(typed, chosen)}
      onSave={(target) => onSave(target, formatOf(chosen), chosenEncoding)}
      accessory={
        <>
          <SavePanelRow ref={row} label="File Format:" labelId={label}>
            <PopUpButton
              aria-labelledby={label}
              value={chosen}
              onValueChange={(next) => {
                if (!next) return;
                setChosen(next);
                // Switching the format switches the name's extension, as on a Mac.
                setSheetName(row.current, next, addTxt);
              }}
              style={{ width: 252 }}
            >
              {DRIVE_FORMATS.map((entry) => (
                <PopUpButtonItem key={entry.value} value={entry.value}>
                  {entry.label}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </SavePanelRow>
          {formatOf(chosen) === "plain" ? (
            <SavePanelRow label="Plain Text Encoding:" labelId={encodingLabel}>
              <PopUpButton
                aria-labelledby={encodingLabel}
                value={chosenEncoding}
                onValueChange={(next) => {
                  if (next) setChosenEncoding(next);
                }}
                style={{ width: 252 }}
              >
                {PLAIN_ENCODINGS.map((entry) => (
                  <PopUpButtonItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </SavePanelRow>
          ) : null}
        </>
      }
    />
  );
}

export interface TextEditRenameProps {
  /** The file's name now. */
  name: string;
  /** Called with the new name, trimmed, when it differs. */
  onRename: (name: string) => void;
  onCancel: () => void;
}

/** The Rename sheet's content: the file's name in a field, Cancel and Rename. */
export function TextEditRename({ name, onRename, onCancel }: TextEditRenameProps) {
  const [value, setValue] = useState(name);
  const field = useId();
  const trimmed = value.trim();
  const submit = () => {
    if (!trimmed) return;
    if (trimmed === name) onCancel();
    else onRename(trimmed);
  };
  return (
    <form
      className="mac-textedit-rename"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <SheetTitle>Rename the document</SheetTitle>
      <SavePanelRow label="Name:" labelFor={field}>
        <TextField
          id={field}
          autoFocus
          value={value}
          onValueChange={setValue}
          style={{ width: 252 }}
        />
      </SavePanelRow>
      <SheetActions>
        <PushButton type="button" onClick={onCancel}>
          Cancel
        </PushButton>
        <DefaultButton type="submit" disabled={!trimmed}>
          Rename
        </DefaultButton>
      </SheetActions>
    </form>
  );
}

/** The Add Link sheet's content: the address in a field, Cancel and OK. */
export function TextEditAddLink({
  onLink,
  onCancel,
}: {
  /** Called with the web address typed. */
  onLink: (address: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("https://");
  const field = useId();
  const address = linkAddress(value);
  return (
    <form
      className="mac-textedit-rename"
      onSubmit={(event) => {
        event.preventDefault();
        if (address) onLink(address);
      }}
    >
      <SheetTitle>Add a link</SheetTitle>
      <SavePanelRow label="Address:" labelFor={field}>
        <TextField
          id={field}
          autoFocus
          value={value}
          onValueChange={setValue}
          style={{ width: 252 }}
        />
      </SavePanelRow>
      <SheetActions>
        <PushButton type="button" onClick={onCancel}>
          Cancel
        </PushButton>
        <DefaultButton type="submit" disabled={!address}>
          OK
        </DefaultButton>
      </SheetActions>
    </form>
  );
}

/** What the File menu shows of the document and the drive. */
export interface TextEditFileMenuState {
  /** Whether the document has a file on the drive (Rename). */
  saved: boolean;
  /** The text documents opened or changed last, for Open Recent. */
  recents: readonly { id: string; name: string }[];
  /** Whether the document can have properties: rich text, not held, and not a web page's file. */
  canShowProperties: boolean;
  /** The panel is up: the row reads Hide Properties. */
  propertiesShown: boolean;
  /** Whether File > Revert To > Last Saved has a version to go back to. */
  hasLastSaved: boolean;
  /** When the version File > Revert To > Previous Save goes back to was written, if one is kept. */
  previousSave?: number;
  /** The document's file, for File > Share; none while it has no file. */
  shared: readonly DesktopDragItem[];
}

/** Why File > Revert To > Last Saved is dimmed. */
export const NOTHING_TO_REVERT = "No saved version of this document is kept.";
/** Why File > Revert To > Previous Save is dimmed. */
export const NO_PREVIOUS_SAVE = "No earlier save of this document is kept.";
/** Why File > Revert To > Browse All Versions is dimmed. */
export const NO_VERSIONS = "This document has no file yet, so it has no versions.";

/** What a pane of the versions sheet shows: the document's rich text, or its plain lines. */
export type TextEditVersionPage = Pick<TextEditDocument, "content" | "lines">;

/** A pane's page in the versions sheet: a copy of the text, which nothing there can change or run. */
export function TextEditVersionPageView({
  page,
  label,
}: {
  page: TextEditVersionPage;
  label: string;
}) {
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = body.current;
    if (!node) return;
    if (page.content) node.replaceChildren(page.content.cloneNode(true));
    else node.textContent = page.lines.join("\n");
  }, [page]);
  return (
    <div
      ref={body}
      className="mac-textedit-version-page"
      data-plain={page.content ? undefined : ""}
      role="document"
      aria-label={label}
    />
  );
}

/** The File menu's commands on the drive. */
export interface TextEditFileCommands {
  newDocument: () => void;
  open: () => void;
  openRecent: (id: string) => void;
  /** Open Recent > Clear Menu: the list starts empty again from now. */
  clearRecents: () => void;
  save: () => void;
  duplicate: () => void;
  rename: () => void;
  moveTo: () => void;
  revert: () => void;
  revertToPrevious: () => void;
  browseVersions: () => void;
  saveAs: () => void;
  exportPdf: () => void;
  pageSetup: () => void;
  print: () => void;
  showProperties: () => void;
}

export interface TextEditFileMenuItemsProps {
  state: TextEditFileMenuState;
  commands: TextEditFileCommands;
  /** Dims every item, while a dialog is shown or the document loads. */
  disabled?: boolean;
}

/**
 * TextEdit's File menu on the drive, as Catalina has it: New, Open, Open Recent, Save, Duplicate,
 * Rename, Move To, Save As, Revert To, Export as PDF, Share, Show Properties, Page Setup and Print.
 */
export function TextEditFileMenuItems({
  state,
  commands,
  disabled = false,
}: TextEditFileMenuItemsProps) {
  return (
    <>
      <MenuItem disabled={disabled} keyEquivalent="command+n" onClick={commands.newDocument}>
        New
      </MenuItem>
      <MenuItem disabled={disabled} keyEquivalent="command+o" onClick={commands.open}>
        Open…
      </MenuItem>
      <Submenu disabled={disabled || state.recents.length === 0}>
        <SubmenuTrigger>Open Recent</SubmenuTrigger>
        <SubmenuPopup aria-label="Open Recent">
          {state.recents.map((recent) => (
            <MenuItem key={recent.id} onClick={() => commands.openRecent(recent.id)}>
              {recent.name}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onClick={commands.clearRecents}>Clear Menu</MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem disabled={disabled} keyEquivalent="command+s" onClick={commands.save}>
        Save…
      </MenuItem>
      <MenuItem disabled={disabled} keyEquivalent="shift+command+s" onClick={commands.duplicate}>
        Duplicate
      </MenuItem>
      <MenuItem disabled={disabled || !state.saved} onClick={commands.rename}>
        Rename…
      </MenuItem>
      <MenuItem disabled={disabled || !state.saved} onClick={commands.moveTo}>
        Move To…
      </MenuItem>
      <MenuItem
        disabled={disabled}
        keyEquivalent="option+shift+command+s"
        onClick={commands.saveAs}
      >
        Save As…
      </MenuItem>
      <Submenu disabled={disabled}>
        <SubmenuTrigger>Revert To</SubmenuTrigger>
        <SubmenuPopup aria-label="Revert To">
          <MenuItem
            disabled={!state.hasLastSaved}
            title={state.hasLastSaved ? undefined : NOTHING_TO_REVERT}
            data-reason={state.hasLastSaved ? undefined : NOTHING_TO_REVERT}
            onClick={commands.revert}
          >
            Last Saved
          </MenuItem>
          <MenuItem
            disabled={state.previousSave === undefined}
            title={
              state.previousSave === undefined ? NO_PREVIOUS_SAVE : versionDate(state.previousSave)
            }
            data-reason={state.previousSave === undefined ? NO_PREVIOUS_SAVE : undefined}
            onClick={commands.revertToPrevious}
          >
            Previous Save
          </MenuItem>
          <MenuItem
            disabled={!state.saved}
            title={state.saved ? undefined : NO_VERSIONS}
            data-reason={state.saved ? undefined : NO_VERSIONS}
            onClick={commands.browseVersions}
          >
            Browse All Versions…
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem disabled={disabled} onClick={commands.exportPdf}>
        Export as PDF…
      </MenuItem>
      <Submenu disabled={disabled}>
        <SubmenuTrigger>Share</SubmenuTrigger>
        <SubmenuPopup aria-label="Share">
          <FileShareItems items={state.shared} from="textedit" />
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem
        disabled={disabled || !state.canShowProperties}
        keyEquivalent="option+command+p"
        onClick={commands.showProperties}
      >
        {state.propertiesShown ? "Hide Properties" : "Show Properties"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={disabled} keyEquivalent="shift+command+p" onClick={commands.pageSetup}>
        Page Setup…
      </MenuItem>
      <MenuItem disabled={disabled} keyEquivalent="command+p" onClick={commands.print}>
        Print…
      </MenuItem>
    </>
  );
}

/** File > Page Setup…: the paper, how it is turned, and the scale in percent. */
export interface PageSetup {
  paper: "letter" | "a4";
  orientation: "portrait" | "landscape";
  scale: number;
}

export const DEFAULT_PAGE_SETUP: PageSetup = {
  paper: "letter",
  orientation: "portrait",
  scale: 100,
};

/** What is printed: the document's name, and its rich text view's HTML or its plain lines. */
export interface PrintableDocument {
  name: string;
  /** The rich text view's content as HTML (its own elements and inline styles). */
  html?: string;
  lines: readonly string[];
  plain: boolean;
  /** A rich document's ruler: its three indents and its tab width, in points. */
  ruler?: { first: number; head: number; tail: number; tab: number };
  /** The page it prints on, how many copies, and the Print sheet's Pages and Two-Sided. */
  page?: PageSetup & {
    copies?: number;
    /** The first and last page, from 1, as the sheet's preview counts them. */
    range?: { from: number; to: number };
    /** A copy of an odd number of pages, as the sheet's preview counts them, leaves a blank back. */
    twoSided?: boolean;
  };
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A rich document's HTML holding only the paragraphs of the pages asked for. The browser tells a page
 * nothing of where its own pages break, so a page here is the preview's: `LINES_PER_PAGE` paragraphs.
 */
function htmlOfPages(html: string, first: number, last: number): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  body.replaceChildren(...[...body.childNodes].slice(first, last));
  return body.innerHTML;
}

/** The page the browser prints for a document: its text on white paper, one-inch margins. */
export function printPage(document: PrintableDocument): string {
  const { page: setup } = document;
  const from = Math.max(Math.trunc(setup?.range?.from ?? 1), 1);
  const to = Math.max(
    Math.trunc(setup?.range?.to ?? Number.MAX_SAFE_INTEGER / LINES_PER_PAGE),
    from,
  );
  const first = (from - 1) * LINES_PER_PAGE;
  const last = to * LINES_PER_PAGE;
  const lines = setup?.range ? document.lines.slice(first, last) : document.lines;
  const body = document.plain
    ? // A form feed is Edit > Insert > Page Break in plain text.
      escapeHtml(lines.join("\n"))
        .split("\f")
        .map((page, at) => `<pre${at > 0 ? ' style="break-before:page"' : ""}>${page}</pre>`)
        .join("")
    : document.html !== undefined
      ? setup?.range
        ? htmlOfPages(document.html, first, last)
        : document.html
      : lines.map((line) => `<div>${escapeHtml(line) || "<br>"}</div>`).join("");
  const copies = Math.min(Math.max(Math.trunc(setup?.copies ?? 1), 1), MOST_COPIES);
  // CSS's `break-after: right` makes no blank page in Chromium's print path, so the blank is written.
  const oddPages = Math.max(Math.ceil(lines.length / LINES_PER_PAGE), 1) % 2 === 1;
  const PAGE_BREAK = '<div data-page-break=""></div>';
  const betweenCopies = setup?.twoSided && oddPages ? PAGE_BREAK + PAGE_BREAK : PAGE_BREAK;
  const size = setup
    ? `size:${setup.paper === "a4" ? "A4" : "Letter"} ${setup.orientation === "landscape" ? "landscape" : "portrait"};`
    : "";
  const scale = setup && setup.scale !== 100 ? `html{zoom:${Number(setup.scale) / 100}}` : "";
  const font = document.plain
    ? "11px / 14px Menlo, Monaco, Consolas, monospace"
    : `12px / ${LINE_HEIGHT} Helvetica, Arial, sans-serif`;
  const { ruler } = document;
  // As `.mac-textedit-text > *` in textedit.css: the page holds no custom properties of the view's.
  const rulerRules = ruler
    ? `body{tab-size:${Number(ruler.tab)}px}` +
      `body>*{margin:0 ${Number(ruler.tail)}px 0 ${Number(ruler.head)}px;text-indent:${Number(ruler.first) - Number(ruler.head)}px}` +
      `body>[data-list]{margin-left:${Number(ruler.head) + 28}px;text-indent:0;list-style-position:outside}`
    : "";
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    // The text is the person's, pasted from anywhere: nothing in it may load or go anywhere.
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'">` +
    `<title>${escapeHtml(document.name)}</title>` +
    `<style>@page{${size}margin:1in}html,body{margin:0;background:#fff;color:#000}${scale}` +
    `body{font:${font};white-space:pre-wrap;overflow-wrap:break-word}` +
    `pre{margin:0;font:inherit;white-space:pre-wrap}` +
    `[data-page-break]{break-after:page}` +
    `table{--cell-border:1px;border-collapse:collapse;table-layout:fixed;width:100%;text-indent:0}` +
    `table:has(colgroup):not(:has(>colgroup>col:not([width]))){width:min-content}` +
    `td{padding:2px 4px;border:var(--cell-border) solid #000;vertical-align:top}` +
    `table[data-border="0"]{--cell-border:0px}table[data-border="2"]{--cell-border:2px}table[data-border="3"]{--cell-border:3px}` +
    `[data-list]{display:list-item;list-style:disc inside}` +
    `[data-list="circle"]{list-style-type:circle}[data-list="square"]{list-style-type:square}` +
    `[data-list="hyphen"]{list-style-type:"\\2013\\00a0\\00a0"}[data-list="decimal"]{list-style-type:decimal}` +
    `[data-list="alpha"]{list-style-type:lower-alpha}[data-list="alphaupper"]{list-style-type:upper-alpha}` +
    `[data-list="roman"]{list-style-type:lower-roman}[data-list="romanupper"]{list-style-type:upper-roman}${rulerRules}</style>` +
    `</head><body>${Array.from({ length: copies }, () => body).join(betweenCopies)}</body></html>`
  );
}

/** The most copies a Print sheet prints: each is the whole document again in the print frame. */
const MOST_COPIES = 99;

/**
 * Prints the document through the browser's print dialog, from a frame of its own that holds the
 * text alone, so "Save as PDF" there writes a PDF of the document. The frame is sandboxed with
 * nothing allowed but the print itself, so nothing in the text can run. It goes once printing has
 * ended (`afterprint`; some browsers return from `print()` while their dialog is still open),
 * when the next document is printed, or after ten minutes at the latest.
 */
export function printDocument(document: PrintableDocument, host: Document = globalThis.document) {
  for (const earlier of host.querySelectorAll("iframe[data-textedit-print]")) earlier.remove();
  const frame = host.createElement("iframe");
  frame.setAttribute("data-textedit-print", "");
  frame.setAttribute("sandbox", "allow-modals allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  frame.srcdoc = printPage(document);
  frame.addEventListener(
    "load",
    () => {
      const view = frame.contentWindow;
      const done = () => frame.remove();
      view?.addEventListener("afterprint", done, { once: true });
      setTimeout(done, 10 * 60_000);
      view?.focus();
      // A font the page brings along has not loaded by the frame's load event.
      const faces = [...(view?.document.fonts ?? [])].map((face) => face.load());
      void Promise.allSettled(faces).then(() => view?.print());
    },
    { once: true },
  );
  host.body.append(frame);
}
