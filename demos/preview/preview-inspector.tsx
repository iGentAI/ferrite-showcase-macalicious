"use client";

import { EmptyState } from "macalicious/empty-state";
import { GradientButton, GradientButtonGroup } from "macalicious/gradient-button";
import {
  InspectorPanel,
  InspectorPanelItem,
  InspectorPanelList,
} from "macalicious/inspector-panel";
import { ListView } from "macalicious/list-view";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { TextField } from "macalicious/text-field";
import { useEffect, useState } from "react";
import type { DriveEntry } from "../desktop/desktop-files";
import type { ExifFacts } from "../photos/photos-exif";
import { MARKUP_LIMITS, type Mark, type Rect } from "./preview-markup";
import type { PdfFile, PdfSecurity } from "./preview-pdf";
import { fromPixels, SIZE_UNITS, type SizeUnit, toPixels } from "./preview-units";

type InspectorTab = "general" | "more" | "keywords" | "annotations" | "encryption" | "crop";

const TAB_TITLES: Record<InspectorTab, string> = {
  general: "General Info",
  more: "More Info",
  keywords: "Keywords",
  annotations: "Annotations",
  encryption: "Encryption",
  crop: "Crop",
};

/** Why a PDF cannot be locked here. */
export const NO_LOCKING =
  "The reader of PDFs here, pdf.js, opens a locked PDF but cannot write one, so no password can be set or removed.";

/** What each kind of mark is called in the Annotations tab. */
const MARK_NAMES: Record<Mark["kind"], string> = {
  rect: "Rectangle",
  oval: "Oval",
  mask: "Mask",
  loupe: "Loupe",
  line: "Line",
  arrow: "Arrow",
  sketch: "Sketch",
  text: "Text",
  signature: "Signature",
  highlight: "Highlight",
  underline: "Underline",
  strikethrough: "Strikethrough",
  note: "Note",
};

/** What the Inspector calls a document's kind, from its file name (the drive keeps no type). */
function kindOf(entry: DriveEntry, kind: "image" | "pdf"): string {
  if (kind === "pdf") return "PDF document";
  const known: Record<string, string> = {
    jpg: "JPEG image",
    jpeg: "JPEG image",
    png: "PNG image",
    gif: "GIF image",
    webp: "WebP image",
    svg: "SVG image",
  };
  const extension = /\.([a-z0-9]+)$/i.exec(entry.name)?.[1]?.toLowerCase() ?? "";
  return known[extension] ?? "Image";
}

/** A size as the Finder writes it, in decimal units: "812 bytes", "48 KB", "3.3 MB". */
function sizeText(bytes: number): string {
  if (bytes < 1000) return `${bytes} bytes`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

const dateText = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

/** An exposure as a camera writes it: "1/250 s", "2 s". */
export const exposureText = (seconds: number) =>
  seconds >= 1 ? `${seconds} s` : `1/${Math.round(1 / seconds)} s`;

/** A position in degrees, with its hemisphere: "48.8584° N". */
export const degreesText = (value: number, positive: string, negative: string) =>
  `${Math.abs(value).toFixed(4)}° ${value < 0 ? negative : positive}`;

function MoreInfo({ exif }: { exif: ExifFacts }) {
  const { camera, settings, takenMs, location } = exif;
  if (!camera && !settings && takenMs === undefined && !location) {
    return <EmptyState role="status">No Camera Details</EmptyState>;
  }
  return (
    <InspectorPanelList>
      {camera ? <InspectorPanelItem label="Camera:">{camera}</InspectorPanelItem> : null}
      {settings?.lens ? (
        <InspectorPanelItem label="Lens:">{settings.lens}</InspectorPanelItem>
      ) : null}
      {takenMs !== undefined ? (
        <InspectorPanelItem label="Taken:">{dateText(takenMs)}</InspectorPanelItem>
      ) : null}
      {settings?.iso !== undefined ? (
        <InspectorPanelItem label="ISO:">{settings.iso}</InspectorPanelItem>
      ) : null}
      {settings?.aperture !== undefined ? (
        <InspectorPanelItem label="Aperture:">{`f/${settings.aperture}`}</InspectorPanelItem>
      ) : null}
      {settings?.exposure !== undefined ? (
        <InspectorPanelItem label="Exposure:">{exposureText(settings.exposure)}</InspectorPanelItem>
      ) : null}
      {settings?.focal !== undefined ? (
        <InspectorPanelItem label="Focal Length:">{`${settings.focal} mm`}</InspectorPanelItem>
      ) : null}
      {location ? (
        <>
          <InspectorPanelItem label="Latitude:">
            {degreesText(location.lat, "N", "S")}
          </InspectorPanelItem>
          <InspectorPanelItem label="Longitude:">
            {degreesText(location.lon, "E", "W")}
          </InspectorPanelItem>
        </>
      ) : null}
    </InspectorPanelList>
  );
}

/** The Keywords tab: what the file is listed under, kept beside it. */
function Keywords({
  words,
  onChange,
}: {
  words: readonly string[];
  onChange: (words: readonly string[]) => void;
}) {
  const [typed, setTyped] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const word = typed.trim();
  const canAdd = word !== "" && !words.includes(word) && words.length < MARKUP_LIMITS.keywords;
  const add = () => {
    if (!canAdd) return;
    onChange([...words, word]);
    setTyped("");
  };
  return (
    <div className="mac-preview-app-keywords">
      {words.length === 0 ? (
        <EmptyState role="status">No Keywords</EmptyState>
      ) : (
        <ListView
          aria-label="Keywords"
          className="mac-preview-app-inspector-marks"
          count={words.length}
          rowHeight={24}
          getRowId={(index) => words[index] ?? index}
          getRowLabel={(index) => words[index] ?? ""}
          value={chosen ? [chosen] : []}
          onValueChange={(value) => setChosen(value[0] === undefined ? null : String(value[0]))}
          renderRow={(index) => words[index] ?? null}
        />
      )}
      <TextField
        aria-label="New Keyword"
        placeholder="New Keyword"
        maxLength={MARKUP_LIMITS.keyword}
        value={typed}
        onValueChange={setTyped}
        onKeyDown={(event) => {
          if (event.key === "Enter") add();
        }}
      />
      <GradientButtonGroup>
        <GradientButton glyph="add" aria-label="Add Keyword" disabled={!canAdd} onClick={add} />
        <GradientButton
          glyph="remove"
          aria-label="Remove Keyword"
          disabled={!chosen || !words.includes(chosen)}
          onClick={() => {
            onChange(words.filter((each) => each !== chosen));
            setChosen(null);
          }}
        />
      </GradientButtonGroup>
    </div>
  );
}

const yesNo = (allowed: boolean) => (allowed ? "Yes" : "No");

/** The Encryption tab: what a PDF's lock says; a password cannot be set here, and it says why. */
function Encryption({ read }: { read: PdfFile["security"] }) {
  const [security, setSecurity] = useState<PdfSecurity | null>(null);
  useEffect(() => {
    let live = true;
    read().then(
      (found) => {
        if (live) setSecurity(found);
      },
      () => {
        if (live) setSecurity({});
      },
    );
    return () => {
      live = false;
    };
  }, [read]);
  if (!security) return null;
  const { method, allowed } = security;
  return (
    <InspectorPanelList>
      <InspectorPanelItem label="Encrypted:">{method ? "Yes" : "No"}</InspectorPanelItem>
      {method ? <InspectorPanelItem label="Method:">{method}</InspectorPanelItem> : null}
      {allowed ? (
        <>
          <InspectorPanelItem label="Printing:">{yesNo(allowed.print)}</InspectorPanelItem>
          <InspectorPanelItem label="Copying:">{yesNo(allowed.copy)}</InspectorPanelItem>
          <InspectorPanelItem label="Changing:">{yesNo(allowed.change)}</InspectorPanelItem>
          <InspectorPanelItem label="Annotating:">{yesNo(allowed.annotate)}</InspectorPanelItem>
        </>
      ) : null}
      <InspectorPanelItem label="Password:">
        <PushButton disabled title={NO_LOCKING}>
          Set Password…
        </PushButton>
      </InspectorPanelItem>
    </InspectorPanelList>
  );
}

export interface PreviewInspectorProps {
  entry: DriveEntry;
  kind: "image" | "pdf";
  /** A picture's pixels. */
  dimensions?: { width: number; height: number };
  /** A picture's pixels to the inch, for the Crop tab's lengths. */
  dpi?: number;
  /** A new selection typed in the Crop tab, in page space. */
  onSelect?: (rect: Rect) => void;
  /** A PDF's pages, and the size in points of the page shown. */
  pages?: { count: number; width: number; height: number };
  exif: ExifFacts;
  /** Every mark of the document, by page. */
  marks: readonly { page: number; mark: Mark }[];
  /** The mark chosen, and what choosing a row does. */
  selected: string | null;
  onChooseMark: (page: number, mark: Mark) => void;
  /** The file's keywords, and what changing them does. */
  keywords: readonly string[];
  onKeywords: (keywords: readonly string[]) => void;
  /** Reads a PDF's lock. */
  security?: PdfFile["security"];
  /** A picture's selection and what it keeps now, in page space. */
  selection: Rect | null;
  kept: Rect;
  onClose: () => void;
}

/** The Crop tab: the selection's place and size in the unit chosen; each can be typed. */
function CropValues({
  rect,
  isSelection,
  dimensions,
  dpi,
  onSelect,
}: {
  rect: Rect;
  isSelection: boolean;
  dimensions: { width: number; height: number };
  dpi: number;
  onSelect?: (rect: Rect) => void;
}) {
  const [unit, setUnit] = useState<SizeUnit>("pixels");
  const whole = {
    x: dimensions.width,
    y: dimensions.height,
    w: dimensions.width,
    h: dimensions.height,
  };
  const field = (side: keyof Rect, label: string) => (
    <InspectorPanelItem label={`${label}:`}>
      <TextField
        // A new value shown over what was typed, when the selection changes or the unit does.
        key={`${side}|${unit}|${rect[side]}`}
        aria-label={label}
        inputMode="decimal"
        defaultValue={fromPixels(rect[side] * whole[side], unit, dpi, whole[side])}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          const value = Number(event.currentTarget.value);
          if (!Number.isFinite(value) || value < 0) return;
          onSelect?.({ ...rect, [side]: toPixels(value, unit, dpi, whole[side]) / whole[side] });
        }}
      />
    </InspectorPanelItem>
  );
  return (
    <InspectorPanelList>
      <InspectorPanelItem label="Showing:">
        {isSelection ? "Selection" : "Picture"}
      </InspectorPanelItem>
      {field("x", "Left")}
      {field("y", "Top")}
      {field("w", "Width")}
      {field("h", "Height")}
      <InspectorPanelItem label="Units:">
        <PopUpButton
          aria-label="Units"
          value={unit}
          onValueChange={(value) => value && setUnit(value as SizeUnit)}
        >
          {SIZE_UNITS.map((each) => (
            <PopUpButtonItem key={each.value} value={each.value}>
              {each.label}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </InspectorPanelItem>
    </InspectorPanelList>
  );
}

/** Tools > Show Inspector: General Info, More Info, Annotations and, for a picture, Crop. */
export function PreviewInspector({
  entry,
  kind,
  dimensions,
  dpi = 72,
  onSelect,
  pages,
  exif,
  marks,
  selected,
  onChooseMark,
  keywords,
  onKeywords,
  security,
  selection,
  kept,
  onClose,
}: PreviewInspectorProps) {
  const [chosen, setChosen] = useState<InspectorTab>("general");
  const tabs: InspectorTab[] =
    kind === "image"
      ? ["general", "more", "keywords", "annotations", "crop"]
      : ["general", "keywords", "annotations", "encryption"];
  const tab = tabs.includes(chosen) ? chosen : "general";
  return (
    <InspectorPanel title={TAB_TITLES[tab]} onClose={onClose}>
      <SegmentedControl
        aria-label="Inspector"
        className="mac-preview-app-inspector-tabs"
        size="small"
        distribution="fit"
        value={[tab]}
        onValueChange={(value) => {
          const next = value[0];
          if (next) setChosen(next as InspectorTab);
        }}
      >
        {tabs.map((each) => (
          <Segment key={each} value={each}>
            {each === "general" ? "General" : TAB_TITLES[each]}
          </Segment>
        ))}
      </SegmentedControl>
      {tab === "general" ? (
        <InspectorPanelList>
          <InspectorPanelItem label="Name:">{entry.name}</InspectorPanelItem>
          <InspectorPanelItem label="Kind:">{kindOf(entry, kind)}</InspectorPanelItem>
          <InspectorPanelItem label="Size:">{sizeText(entry.size)}</InspectorPanelItem>
          {dimensions ? (
            <InspectorPanelItem label="Dimensions:">
              {`${dimensions.width} × ${dimensions.height} pixels`}
            </InspectorPanelItem>
          ) : null}
          {pages ? (
            <>
              <InspectorPanelItem label="Pages:">{pages.count}</InspectorPanelItem>
              <InspectorPanelItem label="Page Size:">
                {`${Math.round(pages.width)} × ${Math.round(pages.height)} points`}
              </InspectorPanelItem>
            </>
          ) : null}
          <InspectorPanelItem label="Created:">{dateText(entry.created_ms)}</InspectorPanelItem>
          <InspectorPanelItem label="Modified:">{dateText(entry.modified_ms)}</InspectorPanelItem>
        </InspectorPanelList>
      ) : null}
      {tab === "more" ? <MoreInfo exif={exif} /> : null}
      {tab === "keywords" ? <Keywords words={keywords} onChange={onKeywords} /> : null}
      {tab === "encryption" && security ? <Encryption read={security} /> : null}
      {tab === "annotations" && marks.length === 0 ? (
        <EmptyState role="status">No Annotations</EmptyState>
      ) : null}
      {tab === "annotations" && marks.length > 0 ? (
        <ListView
          aria-label="Annotations"
          className="mac-preview-app-inspector-marks"
          count={marks.length}
          rowHeight={24}
          getRowId={(index) => marks[index]?.mark.id ?? index}
          getRowLabel={(index) => {
            const row = marks[index];
            return row ? `${MARK_NAMES[row.mark.kind]}, page ${row.page}` : "";
          }}
          value={selected ? [selected] : []}
          onValueChange={(value) => {
            const row = marks.find((each) => each.mark.id === value[0]);
            if (row) onChooseMark(row.page, row.mark);
          }}
          renderRow={(index) => {
            const row = marks[index];
            return row ? `${MARK_NAMES[row.mark.kind]}, page ${row.page}` : null;
          }}
        />
      ) : null}
      {tab === "crop" && dimensions ? (
        <CropValues
          rect={selection ?? kept}
          isSelection={selection !== null}
          dimensions={dimensions}
          dpi={dpi}
          onSelect={onSelect}
        />
      ) : null}
    </InspectorPanel>
  );
}
