"use client";

import { Checkbox } from "macalicious/checkbox";
import { ColumnView, type ColumnViewItem, ColumnViewPanel } from "macalicious/column-view";
import { GalleryView } from "macalicious/gallery-view";
import { IconView } from "macalicious/icon-view";
import { ListView, ListViewRowLeading, ListViewRowTitle } from "macalicious/list-view";
import { MenuItem } from "macalicious/menu-item";
import {
  OpenPanel,
  type OpenPanelBrowserProps,
  type OpenPanelLocation,
  type OpenPanelView,
} from "macalicious/open-panel";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PrintPanel, type PrintPanelSettings } from "macalicious/print-panel";
import { PushButton } from "macalicious/push-button";
import { SavePanel, SavePanelRow } from "macalicious/save-panel";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import type { WindowState } from "macalicious/window";
import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from "react";
import { DocumentIcon, FileIcon, FolderIcon, PlaceGlyph } from "./textedit-artwork";
import {
  DEFAULT_PLACE,
  FILE_FORMATS,
  LINES_PER_PAGE,
  listFolder,
  SECTIONS,
  searchPlace,
  type TextEditDocument,
  type TextEditFile,
  type TextEditPlace,
} from "./textedit-data";
import { paginate } from "./textedit-document";

const FILL: CSSProperties = { height: "100%" };

/** A folder of a place the browser has shown: where Back and Forward go. */
interface Visit {
  place: string;
  folders: string[];
}

/** One page of a document as a file's preview: its first lines on white paper. */
function Page({ file }: { file: TextEditFile }) {
  return (
    <div className="mac-textedit-preview-page" data-format={file.document?.format}>
      {file.document?.lines.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the lines of a stored document never reorder
        <div key={index}>{line === "" ? <br /> : line}</div>
      ))}
    </div>
  );
}

/** The preview column of the column view, as Finder draws it for the selected file. */
function Preview({ file }: { file: TextEditFile }) {
  return (
    <ColumnViewPanel className="mac-textedit-preview">
      {file.document ? <Page file={file} /> : <DocumentIcon size={96} />}
      <strong className="mac-textedit-preview-name">{file.name}</strong>
      <span className="mac-textedit-preview-detail">{file.detail}</span>
      {file.information ? (
        <>
          <strong className="mac-textedit-preview-heading">Information</strong>
          {file.information.map(([label, value]) => (
            <div key={label} className="mac-textedit-preview-row">
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
          <strong className="mac-textedit-preview-heading">Tags</strong>
          <span className="mac-textedit-preview-tags">Add Tags…</span>
        </>
      ) : null}
    </ColumnViewPanel>
  );
}

/**
 * The file browser the Open and the Save panel share: which place and folder it shows, what is
 * selected in it, its view, its search and its history, and the props that make an
 * `OpenPanelBrowser` show all that. `onAction` is called with a document that is opened by a
 * double click or by Return.
 */
function useFileBrowser(
  places: readonly TextEditPlace[],
  onAction?: (file: TextEditFile) => void,
  onNewFolder?: (place: string, folders: readonly string[]) => void,
) {
  const [visit, setVisit] = useState<Visit>({ place: DEFAULT_PLACE, folders: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<OpenPanelView>("column");
  const [search, setSearch] = useState("");
  const [back, setBack] = useState<Visit[]>([]);
  const [forward, setForward] = useState<Visit[]>([]);

  const place = places.find((candidate) => candidate.id === visit.place);
  const files = listFolder(place, visit.folders);
  const searching = search.trim() !== "";
  const shown = searching ? searchPlace(place, search) : files;
  const selectedFile = shown.find((file) => file.id === selected);

  // Every file of the place by id, and the items of every column: the same arrays until the
  // place's files change, as the column view asks.
  const [byId, columns] = useMemo(() => {
    const ids = new Map<string, TextEditFile>();
    const lists = new Map<string | null, ColumnViewItem[]>();
    const walk = (parent: string | null, list: readonly TextEditFile[]) => {
      lists.set(
        parent,
        list.map((file) => ({
          id: file.id,
          label: file.name,
          icon: <FileIcon file={file} />,
          hasChildren: file.kind === "folder",
        })),
      );
      for (const file of list) {
        ids.set(file.id, file);
        if (file.kind === "folder") walk(file.id, file.children ?? []);
      }
    };
    walk(null, place?.files ?? []);
    return [ids, lists] as const;
  }, [place]);

  const show = (next: Visit) => {
    setVisit(next);
    setSelected(null);
    setSearch("");
  };
  /** Go to a folder: what was shown goes on the Back list, and Forward is forgotten. */
  const go = (next: Visit) => {
    setBack((visits) => [...visits, visit]);
    setForward([]);
    show(next);
  };
  // In column view a folder is entered when it is selected, so acting on it changes nothing.
  const act = (file: TextEditFile | undefined) => {
    if (file?.kind === "folder") {
      if (!visit.folders.includes(file.id)) {
        go({ place: visit.place, folders: [...visit.folders, file.id] });
      }
    } else if (file) onAction?.(file);
  };

  const select = (value: (string | number)[]) =>
    setSelected(value.length ? String(value[value.length - 1]) : null);
  const idOf = (index: number) => shown[index]?.id ?? index;
  const labelOf = (index: number) => shown[index]?.name ?? "";
  const value = selectedFile ? [selectedFile.id] : [];
  const name = place?.label ?? "Files";

  let children: OpenPanelBrowserProps["children"];
  if (searching || view === "list") {
    children = (
      <ListView
        aria-label={searching ? `Found in ${name}` : name}
        count={shown.length}
        rowHeight={20}
        getRowId={idOf}
        getRowLabel={labelOf}
        renderRow={(index) => {
          const file = shown[index];
          return file ? (
            <>
              <ListViewRowLeading>
                <FileIcon file={file} />
              </ListViewRowLeading>
              <ListViewRowTitle>{file.name}</ListViewRowTitle>
            </>
          ) : null;
        }}
        value={value}
        onValueChange={select}
        onRowAction={(index) => act(shown[index])}
        style={FILL}
      />
    );
  } else if (view === "icon") {
    children = (
      <IconView
        aria-label={name}
        count={shown.length}
        getItemId={idOf}
        getItemLabel={labelOf}
        renderIcon={(index) => {
          const file = shown[index];
          return file ? <FileIcon file={file} size={64} /> : null;
        }}
        value={value}
        onValueChange={select}
        onItemAction={(index) => act(shown[index])}
        style={FILL}
      />
    );
  } else if (view === "gallery") {
    children = (
      <GalleryView
        aria-label={name}
        count={shown.length}
        getItemId={idOf}
        getItemLabel={labelOf}
        renderPreview={(index) => {
          const file = shown[index];
          if (!file) return null;
          return file.document ? <Page file={file} /> : <FileIcon file={file} size={128} />;
        }}
        renderThumbnail={(index) => {
          const file = shown[index];
          return file ? <FileIcon file={file} size={32} /> : null;
        }}
        value={value}
        onValueChange={select}
        onItemAction={(index) => act(shown[index])}
        style={FILL}
      />
    );
  } else {
    children = (
      // A new place starts a new browser: the path of the old one means nothing in it.
      <ColumnView
        key={visit.place}
        aria-label={name}
        getChildren={(id) =>
          byId.get(String(id))?.kind === "folder" || id === null
            ? columns.get(id === null ? null : String(id))
            : null
        }
        path={selected && byId.has(selected) ? [...visit.folders, selected] : visit.folders}
        onPathChange={(path) => {
          const last = path.length ? byId.get(String(path[path.length - 1])) : undefined;
          const ids = path.map(String);
          if (!last || last.kind === "folder") {
            setVisit({ place: visit.place, folders: ids });
            setSelected(null);
          } else {
            setVisit({ place: visit.place, folders: ids.slice(0, -1) });
            setSelected(last.id);
          }
        }}
        defaultColumnWidths={[204, 540]}
        renderPreview={(item) => {
          const file = byId.get(String(item.id));
          return file ? <Preview file={file} /> : null;
        }}
        onItemAction={(item) => act(byId.get(String(item.id)))}
      />
    );
  }

  const sidebar = (
    <Sidebar
      aria-label="Places"
      material="opaque"
      value={visit.place}
      onValueChange={(id) => id !== visit.place && go({ place: id, folders: [] })}
      style={FILL}
    >
      {SECTIONS.map((section) => (
        <SidebarSection key={section} title={section}>
          {places
            .filter((candidate) => candidate.section === section)
            .map((candidate) => (
              <SidebarItem
                key={candidate.id}
                value={candidate.id}
                label={candidate.label}
                icon={<PlaceGlyph glyph={candidate.glyph} />}
              />
            ))}
        </SidebarSection>
      ))}
    </Sidebar>
  );

  const browser = {
    view,
    onViewChange: setView,
    canGoBack: back.length > 0,
    canGoForward: forward.length > 0,
    onBack: () => {
      const last = back[back.length - 1];
      if (!last) return;
      setBack(back.slice(0, -1));
      setForward([...forward, visit]);
      show(last);
    },
    onForward: () => {
      const next = forward[forward.length - 1];
      if (!next) return;
      setForward(forward.slice(0, -1));
      setBack([...back, visit]);
      show(next);
    },
    search,
    onSearchChange: setSearch,
    onNewFolder: onNewFolder && (() => onNewFolder(visit.place, visit.folders)),
    sidebar,
    header: place?.header,
    children,
  } satisfies OpenPanelBrowserProps;

  return {
    browser,
    place: visit.place,
    folders: visit.folders,
    setPlace: (id: string) => id !== visit.place && go({ place: id, folders: [] }),
    selectedFile,
    act,
  };
}

/** The places as the items of a location button, each with a folder before its name. */
const locationsOf = (places: readonly TextEditPlace[]): OpenPanelLocation[] =>
  places
    .filter((place) => place.section === "Favorites" || place.section === "iCloud")
    .map((place, index, all) => ({
      value: place.id,
      label: place.label,
      icon: <FolderIcon />,
      separatorBefore: index > 0 && all[index - 1]?.section !== place.section,
    }));

export interface TextEditOpenPanelProps {
  /** The places and their files. */
  places: readonly TextEditPlace[];
  /** Whether the panel is the key window: it is, unless the app itself is in the background. */
  state: WindowState;
  /** Called with the document to open, read as plain text when the options say so. */
  onOpen: (document: TextEditDocument) => void;
  /** Called when the panel is cancelled. */
  onCancel: () => void;
  /** Called by the New Document button. */
  onNewDocument: () => void;
  /** Called by the New Folder button with the place and the chain of folders shown in it. */
  onNewFolder: (place: string, folders: readonly string[]) => void;
}

/**
 * TextEdit's Open dialog: the library's `OpenPanel` on the app's files, with the two buttons
 * TextEdit adds to its bar. "New Document" starts an empty document; "Options" shows the
 * accessory view with "Ignore rich text commands", which opens a document as plain text.
 */
export function TextEditOpenPanel({
  places,
  state,
  onOpen,
  onCancel,
  onNewDocument,
  onNewFolder,
}: TextEditOpenPanelProps) {
  const [options, setOptions] = useState(false);
  const [ignoreRichText, setIgnoreRichText] = useState(false);
  const open = (file: TextEditFile) => {
    if (file.document) {
      const { name, lines } = file.document;
      onOpen(ignoreRichText ? { name, format: "plain", lines } : file.document);
    }
  };
  const { browser, place, setPlace, selectedFile, act } = useFileBrowser(places, open, onNewFolder);
  const canOpen = selectedFile?.kind === "folder" || selectedFile?.document !== undefined;
  // The panel takes the keyboard when it is shown: its file list, where the arrow keys choose
  // a file, Return opens it and Escape cancels. No focus ring is asked for: the captures
  // show none around the list.
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current
      ?.querySelector<HTMLElement>('[role="listbox"]')
      ?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  }, []);

  return (
    <OpenPanel
      {...browser}
      ref={panel}
      className="mac-textedit-open-panel"
      state={state}
      width={914}
      height={615}
      locations={locationsOf(places)}
      location={places.some((candidate) => candidate.id === place) ? place : null}
      onLocationChange={setPlace}
      openDisabled={!canOpen}
      onOpen={() => act(selectedFile)}
      onCancel={onCancel}
      leading={
        <>
          <PushButton onClick={onNewDocument}>New Document</PushButton>
          <PushButton aria-expanded={options} onClick={() => setOptions(!options)}>
            Options
          </PushButton>
        </>
      }
      accessory={
        options ? (
          <Checkbox checked={ignoreRichText} onCheckedChange={setIgnoreRichText}>
            Ignore rich text commands
          </Checkbox>
        ) : undefined
      }
    />
  );
}

/** What the Save panel hands over: the name, the place and the format to save in. */
export interface TextEditSaveValues {
  /** The name typed. */
  name: string;
  /** The id of the place chosen. */
  place: string;
  /** The chain of folder ids shown in that place's browser: where in the place to save. */
  folders: readonly string[];
  /** The format chosen in the File Format button. */
  format: TextEditDocument["format"];
}

export interface TextEditSavePanelProps {
  /** The places and their files. */
  places: readonly TextEditPlace[];
  /** The document being saved: its name and format start the panel. */
  document: TextEditDocument;
  /** Whether the file browser is shown. */
  expanded: boolean;
  /** Called when the disclosure button beside the name shows or hides the browser. */
  onExpandedChange: (expanded: boolean) => void;
  /** Called with the name, place and format when Save is activated. */
  onSave: (values: TextEditSaveValues) => void;
  /** Called when Cancel is activated. */
  onCancel: () => void;
  /** Called by the New Folder button with the place and the chain of folders shown in it. */
  onNewFolder: (place: string, folders: readonly string[]) => void;
}

/**
 * The content of TextEdit's Save sheet: the library's `SavePanel` with the app's places and
 * files in its browser and a File Format button as its accessory row.
 */
export function TextEditSavePanel({
  places,
  document,
  expanded,
  onExpandedChange,
  onSave,
  onCancel,
  onNewFolder,
}: TextEditSavePanelProps) {
  const { browser, place, folders, setPlace } = useFileBrowser(places, undefined, onNewFolder);
  const [format, setFormat] = useState<string>(document.format === "plain" ? "txt" : "rtf");
  const formatLabel = useId();
  return (
    <SavePanel
      defaultName={document.name}
      locations={locationsOf(places)}
      location={place}
      onLocationChange={setPlace}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      browser={{ ...browser, sidebarWidth: 140 }}
      onCancel={onCancel}
      onSave={({ name }) =>
        onSave({
          name: name.trim(),
          place,
          // The collapsed panel names a place only: the document goes to its top level.
          folders: expanded ? folders : [],
          format: FILE_FORMATS.find((entry) => entry.value === format)?.format ?? "rich",
        })
      }
      style={{ "--mac-save-panel-browser-height": "240px" } as CSSProperties}
      accessory={
        <SavePanelRow label="File Format:" labelId={formatLabel}>
          <PopUpButton
            aria-labelledby={formatLabel}
            value={format}
            onValueChange={(next) => next && setFormat(next)}
            style={{ width: 252 }}
          >
            {FILE_FORMATS.map((entry) => (
              <PopUpButtonItem key={entry.value} value={entry.value}>
                {entry.label}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </SavePanelRow>
      }
    />
  );
}

export interface TextEditPrintPanelProps {
  /** The document's name, for the header of a printed page. */
  name: string;
  /** The document's lines as they are now. */
  lines: readonly string[];
  /** Whether the document is plain text, which prints in the fixed-pitch font. */
  plain: boolean;
  /** File > Page Setup…'s paper and orientation, which the sheet starts on. */
  setup?: { paper: string; orientation: "portrait" | "landscape" };
  /** Called with the settings when Print is activated. */
  onPrint: (settings: PrintPanelSettings) => void;
  /** Called when Cancel is activated. */
  onCancel: () => void;
  /** Called by "Save as PDF…" of the PDF button. */
  onSaveAsPdf: () => void;
}

/**
 * The content of TextEdit's Print sheet: the library's `PrintPanel` in its detailed form, with
 * the document's pages in the preview and TextEdit's own pane of two checkboxes. The header
 * and footer checkbox draws the document's name and the page number on the previewed page.
 */
export function TextEditPrintPanel({
  name,
  lines,
  plain,
  setup,
  onPrint,
  onCancel,
  onSaveAsPdf,
}: TextEditPrintPanelProps) {
  const pages = paginate(lines, LINES_PER_PAGE);
  const [page, setPage] = useState(1);
  const [headerAndFooter, setHeaderAndFooter] = useState(false);
  const [settings, setSettings] = useState<PrintPanelSettings>({
    printer: "brother",
    preset: "default",
    copies: 1,
    twoSided: false,
    pages: "all",
    from: 1,
    to: pages.length,
    paperSize: setup?.paper ?? "letter",
    orientation: setup?.orientation ?? "portrait",
    pane: "app",
  });
  const shown = Math.min(page, pages.length);
  return (
    <PrintPanel
      defaultDetailed
      settings={settings}
      // The last two entries of the Presets menu are commands, which the demo does not have:
      // choosing one leaves the preset as it was.
      onSettingsChange={(next) =>
        setSettings(/^(save-preset|show-presets)$/.test(next.preset) ? settings : next)
      }
      printers={[
        { value: "brother", label: "Brother HL-2270DW series" },
        { value: "office", label: "Office Laser" },
      ]}
      presets={[
        { value: "default", label: "Default Settings" },
        { value: "last", label: "Last Used Settings" },
        { value: "black-and-white", label: "Black and White", separatorBefore: true },
        {
          value: "save-preset",
          label: "Save Current Settings as Preset…",
          separatorBefore: true,
        },
        { value: "show-presets", label: "Show Presets…" },
      ]}
      paperSizes={[
        { value: "letter", label: "US Letter", description: "8.50 by 11.00 inches" },
        { value: "a4", label: "A4", description: "210 by 297 mm", aspectRatio: 210 / 297 },
      ]}
      panes={[
        {
          value: "app",
          label: "TextEdit",
          content: (
            <div className="mac-textedit-print-options">
              <Checkbox checked={headerAndFooter} onCheckedChange={setHeaderAndFooter}>
                Print header and footer
              </Checkbox>
              <Checkbox defaultChecked>Rewrap contents to fit page</Checkbox>
              {settings.twoSided ? (
                <p className="mac-textedit-print-note">
                  Each copy starts on a new sheet: one of an odd number of pages leaves a blank
                  back. Choose two-sided in the browser’s print dialog too: only it can tell the
                  printer.
                </p>
              ) : null}
            </div>
          ),
        },
      ]}
      pageCount={pages.length}
      page={shown}
      onPageChange={setPage}
      preview={
        <div className="mac-textedit-print-page" data-plain={plain ? "" : undefined}>
          {headerAndFooter ? <div className="mac-textedit-print-header">{name}</div> : null}
          {pages[shown - 1]?.map((line, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the lines of one page, drawn once
            <div key={index}>{line === "" ? <br /> : line}</div>
          ))}
          {headerAndFooter ? (
            <div className="mac-textedit-print-footer">
              Page {shown} of {pages.length}
            </div>
          ) : null}
        </div>
      }
      pdfMenu={<MenuItem onClick={onSaveAsPdf}>Save as PDF…</MenuItem>}
      onCancel={onCancel}
      onPrint={onPrint}
    />
  );
}
