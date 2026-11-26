"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { Popover, PopoverPopup } from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { SavePanelRow } from "macalicious/save-panel";
import { SheetActions, SheetTitle } from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { TokenField } from "macalicious/token-field";
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { type Drive, entryOf, inTrash } from "../desktop/desktop-files";
import { keepText, useKeptTextValue } from "../desktop/desktop-kept-text";
import type { ParagraphSpacing } from "./textedit-document";
import { DEFAULT_PAGE_SETUP, type PageSetup } from "./textedit-drive";
import { type CopiedStyle, styleName } from "./textedit-format";

/*
 * The sheets of File > Move To…, File > Page Setup…, Format > Text > Spacing… and Format > Font >
 * Styles…, and the popover a click on the title of a document with a file opens.
 */

const submitted = (event: FormEvent, run: () => void) => {
  event.preventDefault();
  run();
};

/** A folder of the drive that a document can go in, named with the folders it is in. */
export interface DriveFolderChoice {
  id: string;
  label: string;
}

/** Every folder of the drive outside the Trash, by the path a person reads. */
export function folderChoices(drive: Drive | null): DriveFolderChoice[] {
  if (!drive) return [];
  const pathOf = (id: string): string => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (let entry = entryOf(drive, id); entry && !seen.has(entry.id); ) {
      seen.add(entry.id);
      names.unshift(entry.name);
      entry = entry.parent ? entryOf(drive, entry.parent) : undefined;
    }
    return names.join(" ▸ ");
  };
  return drive.entries
    .filter((entry) => entry.kind === "folder" && !inTrash(drive, entry.id))
    .map((entry) => ({ id: entry.id, label: pathOf(entry.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function FolderPopUp({
  folders,
  value,
  onChange,
}: {
  folders: readonly DriveFolderChoice[];
  value: string;
  onChange: (folder: string) => void;
}) {
  const label = useId();
  return (
    <SavePanelRow label="Where:" labelId={label}>
      <PopUpButton
        aria-labelledby={label}
        value={value}
        onValueChange={(next) => next && onChange(String(next))}
        style={{ width: 252 }}
      >
        {folders.map((folder) => (
          <PopUpButtonItem key={folder.id} value={folder.id}>
            {folder.label}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
    </SavePanelRow>
  );
}

/** The Move To sheet's content: the folder in a pop-up, Cancel and Move. */
export function TextEditMove({
  folders,
  current,
  onMove,
  onCancel,
}: {
  folders: readonly DriveFolderChoice[];
  /** The folder the file is in now. */
  current: string;
  onMove: (folder: string) => void;
  onCancel: () => void;
}) {
  const [chosen, setChosen] = useState(current);
  return (
    <form
      className="mac-textedit-rename"
      onSubmit={(event) => submitted(event, () => onMove(chosen))}
    >
      <SheetTitle>Move the document</SheetTitle>
      <FolderPopUp folders={folders} value={chosen} onChange={setChosen} />
      <SheetActions>
        <PushButton type="button" onClick={onCancel}>
          Cancel
        </PushButton>
        <DefaultButton type="submit" disabled={chosen === current}>
          Move
        </DefaultButton>
      </SheetActions>
    </form>
  );
}

/** Page settings as stored, or `undefined` when they are not. */
export function readPageSetup(stored: unknown): PageSetup | undefined {
  const setup = stored as Partial<PageSetup> | null | undefined;
  if (typeof setup !== "object" || setup === null) return undefined;
  const { paper, orientation, scale } = setup;
  return (paper === "letter" || paper === "a4") &&
    (orientation === "portrait" || orientation === "landscape") &&
    typeof scale === "number" &&
    scale >= 1 &&
    scale <= 999
    ? { paper, orientation, scale }
    : undefined;
}

/** Why Page Setup's Format For is dimmed. */
export const PRINTER_REASON = "The browser’s print dialog chooses the printer.";

/** The Page Setup sheet's content: paper, orientation and scale. */
export function TextEditPageSetup({
  value = DEFAULT_PAGE_SETUP,
  onChoose,
  onCancel,
}: {
  value?: PageSetup;
  onChoose: (setup: PageSetup) => void;
  onCancel: () => void;
}) {
  const [paper, setPaper] = useState(value.paper);
  const [orientation, setOrientation] = useState(value.orientation);
  const [scale, setScale] = useState(String(value.scale));
  const scaleField = useId();
  const formatLabel = useId();
  const paperLabel = useId();
  const orientationLabel = useId();
  const percent = Number(scale);
  const valid = Number.isInteger(percent) && percent >= 1 && percent <= 999;
  return (
    <form
      className="mac-textedit-rename"
      onSubmit={(event) =>
        submitted(event, () => {
          if (valid) onChoose({ paper, orientation, scale: percent });
        })
      }
    >
      <SheetTitle>Page Setup</SheetTitle>
      <SavePanelRow label="Format For:" labelId={formatLabel}>
        <PopUpButton
          aria-labelledby={formatLabel}
          disabled
          title={PRINTER_REASON}
          data-reason={PRINTER_REASON}
          value="any"
          style={{ width: 200 }}
        >
          <PopUpButtonItem value="any">Any Printer</PopUpButtonItem>
        </PopUpButton>
      </SavePanelRow>
      <SavePanelRow label="Paper Size:" labelId={paperLabel}>
        <PopUpButton
          aria-labelledby={paperLabel}
          value={paper}
          onValueChange={(next) => setPaper(next === "a4" ? "a4" : "letter")}
          style={{ width: 200 }}
        >
          <PopUpButtonItem value="letter">US Letter</PopUpButtonItem>
          <PopUpButtonItem value="a4">A4</PopUpButtonItem>
        </PopUpButton>
      </SavePanelRow>
      <SavePanelRow label="Orientation:" labelId={orientationLabel}>
        <RadioGroup
          aria-labelledby={orientationLabel}
          value={orientation}
          onValueChange={(next) => setOrientation(next === "landscape" ? "landscape" : "portrait")}
        >
          <RadioButton value="portrait">Portrait</RadioButton>
          <RadioButton value="landscape">Landscape</RadioButton>
        </RadioGroup>
      </SavePanelRow>
      <SavePanelRow label="Scale:" labelFor={scaleField}>
        <TextField id={scaleField} value={scale} onValueChange={setScale} style={{ width: 64 }} /> %
      </SavePanelRow>
      <SheetActions>
        <PushButton type="button" onClick={onCancel}>
          Cancel
        </PushButton>
        <DefaultButton type="submit" disabled={!valid}>
          OK
        </DefaultButton>
      </SheetActions>
    </form>
  );
}

/** The line height multiples a paragraph keeps, in the draft and in an RTF file. */
const MULTIPLES = ["1.0", "1.2", "1.5", "2.0"];

const points = (text: string) => {
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 && value <= 999 ? value : undefined;
};

/** The Spacing sheet's content: the line height multiple and the space around the paragraph. */
export function TextEditSpacing({
  value,
  onChoose,
  onCancel,
}: {
  value: ParagraphSpacing;
  onChoose: (spacing: ParagraphSpacing) => void;
  onCancel: () => void;
}) {
  const [multiple, setMultiple] = useState(value.multiple);
  const [before, setBefore] = useState(String(value.before));
  const [after, setAfter] = useState(String(value.after));
  const multipleLabel = useId();
  const beforeField = useId();
  const afterField = useId();
  const spaceBefore = points(before);
  const spaceAfter = points(after);
  const valid = spaceBefore !== undefined && spaceAfter !== undefined;
  return (
    <form
      className="mac-textedit-rename"
      onSubmit={(event) =>
        submitted(event, () => {
          if (valid) onChoose({ multiple, before: spaceBefore, after: spaceAfter });
        })
      }
    >
      <SheetTitle>Spacing</SheetTitle>
      <SavePanelRow label="Line height multiple:" labelId={multipleLabel}>
        <PopUpButton
          aria-labelledby={multipleLabel}
          value={multiple}
          onValueChange={(next) => next && setMultiple(String(next))}
          style={{ width: 80 }}
        >
          {MULTIPLES.map((each) => (
            <PopUpButtonItem key={each} value={each}>
              {each}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </SavePanelRow>
      <SavePanelRow label="Paragraph spacing before:" labelFor={beforeField}>
        <TextField
          id={beforeField}
          value={before}
          onValueChange={setBefore}
          style={{ width: 64 }}
        />
      </SavePanelRow>
      <SavePanelRow label="Paragraph spacing after:" labelFor={afterField}>
        <TextField id={afterField} value={after} onValueChange={setAfter} style={{ width: 64 }} />
      </SavePanelRow>
      <SheetActions>
        <PushButton type="button" onClick={onCancel}>
          Cancel
        </PushButton>
        <DefaultButton type="submit" disabled={!valid}>
          OK
        </DefaultButton>
      </SheetActions>
    </form>
  );
}

const FAVORITES = "textedit.favoriteStyles";

function favoritesFrom(stored: string | undefined): CopiedStyle[] {
  if (stored === undefined) return [];
  try {
    const list: unknown = JSON.parse(stored);
    return Array.isArray(list)
      ? list.filter(
          (each): each is CopiedStyle =>
            typeof each === "object" &&
            each !== null &&
            Object.values(each).every((value) => typeof value === "string"),
        )
      : [];
  } catch {
    return [];
  }
}

/** A style's sample: its name, drawn in that style. */
const sampleOf = (style: CopiedStyle): CSSProperties =>
  Object.fromEntries(
    Object.entries(style)
      .filter(([name]) => !name.startsWith("-webkit"))
      .map(([name, value]) => [
        name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
        value,
      ]),
  ) as CSSProperties;

/** Why Apply is dimmed. */
const SELECT_TEXT = "Select the text to give the style to.";

/**
 * The Styles sheet's content: the document's styles or the person's favourites, saved with their
 * account, each named and drawn in itself. Apply gives the chosen one to the selection.
 */
export function TextEditStyles({
  styles,
  canApply,
  onApply,
  onCancel,
}: {
  /** The styles of the document's text. */
  styles: readonly CopiedStyle[];
  /** Whether text is selected. */
  canApply: boolean;
  onApply: (style: CopiedStyle) => void;
  onCancel: () => void;
}) {
  const favorites = favoritesFrom(useKeptTextValue(FAVORITES));
  const [showing, setShowing] = useState<"document" | "favorites">("document");
  const [chosen, setChosen] = useState(0);
  const [full, setFull] = useState(false);
  const showLabel = useId();
  const list = showing === "document" ? styles : favorites;
  const style = list[chosen];
  const isFavorite =
    style !== undefined && favorites.some((each) => JSON.stringify(each) === JSON.stringify(style));
  const addFavorite = () => {
    if (style) setFull(!keepText(FAVORITES, JSON.stringify([...favorites, style])));
  };
  const removeFavorite = () => {
    keepText(FAVORITES, JSON.stringify(favorites.filter((_, at) => at !== chosen)));
    setChosen(0);
    setFull(false);
  };
  return (
    <form
      className="mac-textedit-rename"
      onSubmit={(event) =>
        submitted(event, () => {
          if (style && canApply) onApply(style);
        })
      }
    >
      <SheetTitle>Styles</SheetTitle>
      <SavePanelRow label="Show:" labelId={showLabel}>
        <PopUpButton
          aria-labelledby={showLabel}
          value={showing}
          onValueChange={(next) => {
            setShowing(next === "favorites" ? "favorites" : "document");
            setChosen(0);
          }}
          style={{ width: 200 }}
        >
          <PopUpButtonItem value="document">Document Styles</PopUpButtonItem>
          <PopUpButtonItem value="favorites">Favorite Styles</PopUpButtonItem>
        </PopUpButton>
      </SavePanelRow>
      <RadioGroup
        aria-label="Style"
        className="mac-textedit-styles"
        value={String(chosen)}
        onValueChange={(next) => setChosen(Number(next))}
      >
        {list.map((each, at) => (
          <RadioButton key={JSON.stringify(each)} value={String(at)}>
            <span style={sampleOf(each)}>{styleName(each)}</span>
          </RadioButton>
        ))}
      </RadioGroup>
      <SheetActions
        leading={
          showing === "document" ? (
            <PushButton
              type="button"
              disabled={!style || isFavorite || full}
              title={full ? "There is no room for more favorites." : undefined}
              onClick={addFavorite}
            >
              Add to Favorites
            </PushButton>
          ) : (
            <PushButton type="button" disabled={!style} onClick={removeFavorite}>
              Remove
            </PushButton>
          )
        }
      >
        <PushButton type="button" onClick={onCancel}>
          Cancel
        </PushButton>
        <DefaultButton
          type="submit"
          disabled={!style || !canApply}
          title={canApply ? undefined : SELECT_TEXT}
        >
          Apply
        </DefaultButton>
      </SheetActions>
    </form>
  );
}

/** How far the pointer may move between press and release for it to be a click, not a drag. */
const CLICK_SLOP = 4;
/** How long a click waits for a second, which zooms the window instead. */
const DOUBLE_CLICK_MS = 250;

export interface TextEditTitleProps {
  /** What the title bar shows. */
  title: ReactNode;
  /** The file's name. */
  name: string;
  tags: readonly string[];
  folders: readonly DriveFolderChoice[];
  /** The folder the file is in. */
  parent: string;
  /** Whether the file is locked: then it can be neither renamed, moved nor changed. */
  locked: boolean;
  onRename: (name: string) => void;
  onTags: (tags: string[]) => void;
  onMove: (folder: string) => void;
  onLocked: (locked: boolean) => void;
}

function TitlePopover({
  name,
  tags,
  folders,
  parent,
  locked,
  onRename,
  onTags,
  onMove,
  onLocked,
}: Omit<TextEditTitleProps, "title">) {
  const [typed, setTyped] = useState(name);
  const nameField = useId();
  const tagsLabel = useId();
  // Return and then leaving the field are one rename: the file's new name may be longer than what was typed.
  const committed = useRef(name);
  const commit = () => {
    const trimmed = typed.trim();
    if (!trimmed || trimmed === committed.current) return;
    committed.current = trimmed;
    onRename(trimmed);
  };
  return (
    <form className="mac-textedit-title-form" onSubmit={(event) => submitted(event, commit)}>
      <SavePanelRow label="Name:" labelFor={nameField}>
        <TextField
          id={nameField}
          autoFocus
          disabled={locked}
          value={typed}
          onValueChange={setTyped}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
          style={{ width: 200 }}
        />
      </SavePanelRow>
      <SavePanelRow label="Tags:" labelId={tagsLabel}>
        <TokenField
          aria-labelledby={tagsLabel}
          value={tags}
          onValueChange={onTags}
          style={{ width: 200 }}
        />
      </SavePanelRow>
      <FolderPopUp folders={folders} value={parent} onChange={onMove} />
      <SavePanelRow>
        <Checkbox checked={locked} onCheckedChange={(checked) => onLocked(checked === true)}>
          Locked
        </Checkbox>
      </SavePanelRow>
    </form>
  );
}

/**
 * The title of a document with a file: a click opens the popover of its name, tags and folder. A
 * press that moves the pointer moves the window, so the title stays part of the bar's drag region
 * and is no button; File > Rename… and File > Move To… are the same commands by keyboard.
 */
export function TextEditTitle({ title, ...popover }: TextEditTitleProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const waiting = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(waiting.current), []);
  return (
    <>
      <span
        ref={setAnchor}
        className="mac-textedit-title"
        onPointerDown={(event) => {
          clearTimeout(waiting.current);
          // Command-click is the path menu, the title bar's.
          if (event.metaKey || event.ctrlKey) return;
          const { clientX, clientY } = event;
          // On the document: the window's move holds the pointer once pressed, so no click reaches the title.
          event.currentTarget.ownerDocument.addEventListener(
            "pointerup",
            (up) => {
              if (
                Math.abs(up.clientX - clientX) <= CLICK_SLOP &&
                Math.abs(up.clientY - clientY) <= CLICK_SLOP
              ) {
                waiting.current = setTimeout(() => setOpen(true), DOUBLE_CLICK_MS);
              }
            },
            { capture: true, once: true },
          );
        }}
      >
        {title}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverPopup anchor={anchor} aria-label="Document">
          {open ? <TitlePopover {...popover} /> : null}
        </PopoverPopup>
      </Popover>
    </>
  );
}
