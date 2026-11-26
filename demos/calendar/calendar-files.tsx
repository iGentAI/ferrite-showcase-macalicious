"use client";

import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem, PopUpButtonSeparator } from "macalicious/pop-up-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  type SheetPopupProps,
  SheetTitle,
} from "macalicious/sheet";
import { type ChangeEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DesktopDragItem } from "../desktop/desktop-drag";
import { type DriveEntry, readFile } from "../desktop/desktop-files";
import {
  DriveOpenPanel,
  DriveSavePanel,
  type DriveSaveTarget,
  saveToDrive,
} from "../finder/finder-file-dialogs";
import {
  type ArchivedCalendar,
  archiveFileName,
  archiveText,
  readArchive,
} from "./calendar-archive";
import { CALENDAR_COLORS, type CalendarEntry, type OwnCalendar } from "./calendar-data";
import {
  eventsToIcs,
  ICS_LIMITS,
  ICS_TYPE,
  type IcsImport,
  icsFileName,
  parseIcs,
} from "./calendar-ics";
import { documentToServer } from "./calendar-server";

/*
 * Calendar's Import and Export: iCalendar files from and to the computer and, on a desktop
 * served by the Ferrite application, the person's drive. The files are read and written in the
 * browser (calendar-ics.ts); what an import adds is saved with the rest of the person's events.
 */

/** The most events Calendar keeps (`MAX_EVENTS` in the module). */
export const MAX_EVENTS = 1000;
/** The most calendars of a person's own (`MAX_CALENDARS` in the module). */
export const MAX_CALENDARS = 50;
/**
 * The most bytes of the document an import may leave: the store keeps a value of at most 200 KB,
 * and the document is kept with its revision beside it.
 */
export const MAX_DOCUMENT_BYTES = 180_000;
/** The largest file an import reads. */
export const MAX_FILE_BYTES = 5_000_000;

/** What the person is told: a message, and the detail under it. */
export interface CalendarReport {
  message: string;
  detail: string;
}

/**
 * `text` without white space at either end, at least what Rust's `trim` removes (`str::trim` in
 * the module), which JavaScript's own does not all of: U+0085 (NEL). It also takes U+FEFF, which
 * Rust keeps; trimming more than the server does is harmless.
 */
export const trimmed = (text: string) => text.replace(/^[\s\u0085]+|[\s\u0085]+$/g, "");

/** The longest name of a calendar (`MAX_CALENDAR_NAME_CHARS` in the module). */
export const MAX_CALENDAR_NAME = 64;

/**
 * A short, stable id for an imported event, from its UID: the same file imports it once. An
 * event Calendar exported (`<id>@macalicious`) keeps its id, so a file exported and imported
 * again adds nothing either.
 */
export function importedId(uid: string): string {
  const own = /^([A-Za-z0-9._-]{1,128})@macalicious$/.exec(uid);
  if (own?.[1]) return own[1];
  // Two 32-bit FNV-1a hashes with different offsets: 64 bits of the UID.
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (const char of uid) {
    const code = char.codePointAt(0) ?? 0;
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x01000193) ^ (b >>> 15);
  }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, "0");
  return `ics-${hex(a)}${hex(b)}`;
}

/** Where an import puts its events: one of the person's calendars, or a new one by this name. */
export type ImportTarget = { calendar: string } | { newCalendar: string };

/** What an import does to the window's events and calendars. */
export type ImportResult =
  | {
      events: CalendarEntry[];
      own: OwnCalendar[];
      /** The calendar the events went to. */
      calendar: string;
      added: number;
      /** Events of the file already in Calendar (imported before), left as they are. */
      present: number;
    }
  | { refused: CalendarReport };

/** Add the events of `read` to `target`, or say why they cannot be added. */
export function importEvents(
  events: readonly CalendarEntry[],
  own: readonly OwnCalendar[],
  read: IcsImport,
  target: ImportTarget,
  makeId: () => string,
): ImportResult {
  let calendars = [...own];
  let calendar: string;
  if ("newCalendar" in target) {
    if (own.length >= MAX_CALENDARS) {
      return {
        refused: {
          message: "There is no room for another calendar.",
          detail: `Calendar keeps at most ${MAX_CALENDARS} calendars of your own. Choose one of them for the events.`,
        },
      };
    }
    calendar = makeId();
    const used = new Set(own.map((item) => item.color));
    const color = CALENDAR_COLORS.find((item) => !used.has(item.id))?.id ?? "blue";
    const name = trimmed([...trimmed(target.newCalendar)].slice(0, MAX_CALENDAR_NAME).join(""));
    calendars = [...own, { id: calendar, name: name || "Untitled", color }];
  } else calendar = target.calendar;
  const ids = new Set(events.map((entry) => entry.id));
  const added: CalendarEntry[] = [];
  let present = 0;
  for (const event of read.events) {
    const id = importedId(event.uid);
    if (ids.has(id)) {
      present += 1;
      continue;
    }
    ids.add(id);
    const { uid: _uid, ...fields } = event;
    added.push({ ...fields, id, calendar });
  }
  const next = [...events, ...added];
  if (next.length > MAX_EVENTS) {
    return {
      refused: {
        message: `There is no room for ${added.length === 1 ? "the event" : `the ${added.length} events`}.`,
        detail: `Calendar keeps at most ${MAX_EVENTS} events, and has ${events.length}. Delete some to make room.`,
      },
    };
  }
  const bytes = new TextEncoder().encode(JSON.stringify(documentToServer(next, calendars))).length;
  if (bytes > MAX_DOCUMENT_BYTES) {
    return {
      refused: {
        message: "The events are too long to keep.",
        detail:
          "With them, your events would take more room than the desktop keeps for Calendar. Import a file with fewer events, or shorter notes.",
      },
    };
  }
  return { events: next, own: calendars, calendar, added: added.length, present };
}

/** The zones a report names: three at most, each cut short. */
function zoneList(zones: readonly string[]): string {
  const named = zones.slice(0, 3).map((zone) => `“${[...zone].slice(0, 40).join("")}”`);
  const more = zones.length - named.length;
  return more > 0
    ? `${named.join(", ")} and ${plural(more, "other zone", "other zones")}`
    : named.join(", ");
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** What the person is told after an import of `read` from `from`. */
export function importReport(
  read: IcsImport,
  result: { added: number; present: number },
  from: string,
): CalendarReport {
  const details = [
    result.present > 0
      ? `${plural(result.present, "event", "events")} of “${from}” ${result.present === 1 ? "was" : "were"} already in Calendar.`
      : "",
    read.simplified > 0
      ? `${plural(read.simplified, "event repeats", "events repeat")} in a way Calendar does not keep, and ${read.simplified === 1 ? "was" : "were"} imported as a single event.`
      : "",
    read.crowded > 0
      ? `${plural(read.crowded, "repeating event has", "repeating events have")} more removed occurrences than Calendar keeps (${ICS_LIMITS.exdates}); the later ones show again.`
      : "",
    read.shortened > 0
      ? `${plural(read.shortened, "event had", "events had")} a title, notes or address longer than Calendar keeps, which ${read.shortened === 1 ? "was" : "were"} cut short.`
      : "",
    read.skipped > 0
      ? `${plural(read.skipped, "event", "events")} of the file could not be read or ${read.skipped === 1 ? "was" : "were"} cancelled, and ${read.skipped === 1 ? "was" : "were"} left out.`
      : "",
    read.unknownZones.length > 0
      ? `Times in ${zoneList(read.unknownZones)} were read as your own time zone’s.`
      : "",
  ].filter(Boolean);
  return {
    message: result.added === 1 ? "1 event was imported." : `${result.added} events were imported.`,
    detail: details.join(" "),
  };
}

/**
 * What an archive adds: each calendar's events go to the calendar of that name, or one made with its
 * colour. Nothing is replaced, and events already there stay as they are.
 */
export function restoreArchive(
  events: readonly CalendarEntry[],
  own: readonly OwnCalendar[],
  archive: readonly ArchivedCalendar[],
  makeId: () => string,
): ImportResult {
  let now: readonly CalendarEntry[] = events;
  let calendars: readonly OwnCalendar[] = own;
  let first = "";
  let added = 0;
  let present = 0;
  for (const { name, color, read } of archive) {
    const same = calendars.find((item) => item.name === name);
    const next = importEvents(
      now,
      calendars,
      read,
      same ? { calendar: same.id } : { newCalendar: name },
      makeId,
    );
    if ("refused" in next) return next;
    now = next.events;
    calendars = same
      ? next.own
      : next.own.map((item) => (item.id === next.calendar ? { ...item, color } : item));
    first ||= next.calendar;
    added += next.added;
    present += next.present;
  }
  return { events: [...now], own: [...calendars], calendar: first, added, present };
}

/** Whether `file` (picked or dropped) is an iCalendar file or a calendar archive, by its type or its name. */
export const isIcsFile = (file: { type?: string; name: string }) =>
  /text\/calendar/i.test(file.type ?? "") || /\.(ics|ical|icalendar|icbu)$/i.test(file.name);

/** Hand `text` to the browser as a download named `name`. */
function download(text: string, name: string, type = ICS_TYPE) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // The browser has taken the address well before then.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** What a failure says to the person. */
const reason = (error: unknown) =>
  error instanceof Error && error.message ? error.message : "Try again.";

/** A file read and parsed, waiting for the person to choose where its events go. */
interface Pending {
  from: string;
  read: IcsImport;
}

export interface CalendarFilesOptions {
  /** The window's events (each repeating event once). */
  events: readonly CalendarEntry[];
  /** The person's own calendars, which an import can go to. */
  own: readonly OwnCalendar[];
  /** The calendar an import goes to at first. */
  defaultTarget: () => string;
  /** The names of every calendar the window lists, for an export's file and X-WR-CALNAME. */
  nameOf: (id: string) => string | undefined;
  /** Whether the person's drive is there: the desktop is served by the Ferrite application. */
  drive: boolean;
  /** What the sheets hang from: the window's title bar. */
  anchor: SheetPopupProps["anchor"];
  /** Called with what an import adds. */
  onImport: (result: Extract<ImportResult, { events: CalendarEntry[] }>) => void;
  /** Called with what the person is to be told. */
  onReport: (report: CalendarReport) => void;
  /** Makes an id for a new calendar. */
  makeCalendarId: () => string;
}

/** The commands of Import and Export, and the elements they need on the page. */
export interface CalendarFiles {
  /** Import… from the computer, into `preferred` at first when it is one of the person's own. */
  importFile: (preferred?: string) => void;
  /** Import from Drive… (only with `drive`). */
  importFromDrive: (preferred?: string) => void;
  /** Import a file of the drive: one opened from Finder, or dragged onto the window. */
  importEntry: (entry: { id: string; name: string; size?: number }) => void;
  /** Export a calendar, or one event (a repeating one whole), as a download. */
  exportCalendar: (id: string) => void;
  /** File > Calendar Archive…: every calendar of the person's own, as a download. */
  exportArchive: () => void;
  exportEvent: (entry: CalendarEntry) => void;
  /** Save a calendar, or one event, to the drive (only with `drive`). */
  saveCalendar: (id: string) => void;
  saveEvent: (entry: CalendarEntry) => void;
  /** One event (a repeating one whole) as a file to drop on another app or share with one. */
  eventFile: (entry: CalendarEntry) => DesktopDragItem;
  /** The hidden file field, the import sheet and the drive's panels. */
  elements: ReactNode;
}

const NEW_CALENDAR = "\u0000new";

/** The name of a calendar made for a file's events: the file's own name for it, or the file's. */
const newCalendarName = (pending: Pending) =>
  trimmed(
    [...trimmed(pending.read.name ?? pending.from.replace(/\.[^.]+$/, ""))]
      .slice(0, MAX_CALENDAR_NAME)
      .join(""),
  ) || "Untitled";

/** Calendar's Import and Export. */
export function useCalendarFiles(options: CalendarFilesOptions): CalendarFiles {
  const latest = useRef(options);
  latest.current = options;
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  // The calendar the command was given for, which the sheet chooses at first.
  const preferred = useRef<string | undefined>(undefined);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState<{ name: string; text: string } | null>(null);

  const report = (message: string, detail = "") => latest.current.onReport({ message, detail });

  const take = (text: string, from: string) => {
    const archive = readArchive(text);
    if (archive) {
      const { events, own, makeCalendarId, onImport, onReport } = latest.current;
      const result = restoreArchive(events, own, archive, makeCalendarId);
      if ("refused" in result) {
        onReport(result.refused);
        return;
      }
      onImport(result);
      report(
        result.added === 1 ? "1 event was imported." : `${result.added} events were imported.`,
        result.present > 0
          ? `${plural(result.present, "event", "events")} of “${from}” ${result.present === 1 ? "was" : "were"} already in Calendar.`
          : "",
      );
      return;
    }
    const read = parseIcs(text);
    if (read.events.length === 0) {
      report(
        `No events were found in “${from}”.`,
        read.skipped > 0
          ? `Its ${plural(read.skipped, "event", "events")} could not be read or ${read.skipped === 1 ? "was" : "were"} cancelled.`
          : "It is not an iCalendar file with events.",
      );
      return;
    }
    setPending({ from, read });
  };

  const chosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.currentTarget;
    const file = field.files?.[0];
    field.value = "";
    if (!file) return;
    if (!isIcsFile(file)) {
      report(`“${file.name}” is not an iCalendar file.`, "Calendar imports .ics and .icbu files.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      report(`“${file.name}” is too large to import.`, "Calendar imports files of up to 5 MB.");
      return;
    }
    try {
      take(await file.text(), file.name);
    } catch (error) {
      report(`“${file.name}” could not be read.`, reason(error));
    }
  };

  const fromDrive = async (entry: { id: string; name: string; size?: number }) => {
    setOpening(false);
    if ((entry.size ?? 0) > MAX_FILE_BYTES) {
      report(`“${entry.name}” is too large to import.`, "Calendar imports files of up to 5 MB.");
      return;
    }
    try {
      take(await (await readFile(entry.id)).text(), entry.name);
    } catch (error) {
      report(`“${entry.name}” could not be read.`, reason(error));
    }
  };

  const finish = (choice: string) => {
    const now = pending;
    setPending(null);
    if (!now) return;
    const { events, own, makeCalendarId, onImport } = latest.current;
    const target: ImportTarget =
      choice === NEW_CALENDAR ? { newCalendar: newCalendarName(now) } : { calendar: choice };
    const result = importEvents(events, own, now.read, target, makeCalendarId);
    if ("refused" in result) {
      latest.current.onReport(result.refused);
      return;
    }
    onImport(result);
    latest.current.onReport(importReport(now.read, result, now.from));
  };

  const icsOf = (list: readonly CalendarEntry[], name?: string) => eventsToIcs(list, { name });
  const ofCalendar = (id: string) => {
    const { events, nameOf } = latest.current;
    const name = nameOf(id) ?? "Calendar";
    return {
      name,
      text: icsOf(
        events.filter((entry) => entry.calendar === id && !entry.series),
        name,
      ),
    };
  };
  /** A repeating event's occurrence is exported as its whole series. */
  const ofEvent = (entry: CalendarEntry) => {
    const series = entry.series
      ? latest.current.events.find((each) => each.id === entry.series)
      : entry;
    const event = series ?? entry;
    return { name: event.title || "Event", text: icsOf([event]) };
  };

  const exporting = (made: () => { name: string; text: string }) => {
    try {
      const { name, text } = made();
      download(text, icsFileName(name));
    } catch (error) {
      report("The calendar could not be exported.", reason(error));
    }
  };

  const save = async (target: DriveSaveTarget) => {
    const file = saving;
    setSaving(null);
    if (!file) return;
    try {
      await saveToDrive(target, new Blob([file.text], { type: ICS_TYPE }));
    } catch (error) {
      report(`“${target.name}” could not be saved.`, reason(error));
    }
  };

  const { own, drive, anchor, defaultTarget } = options;
  const elements = (
    <>
      <input
        ref={input}
        type="file"
        accept=".ics,.ical,.icalendar,.icbu,text/calendar"
        hidden
        aria-label="iCalendar file"
        onChange={(event) => void chosen(event)}
      />
      <ImportSheet
        pending={pending}
        own={own}
        defaultTarget={() => {
          const wanted = preferred.current;
          return wanted && own.some((item) => item.id === wanted) ? wanted : defaultTarget();
        }}
        anchor={anchor}
        onCancel={() => setPending(null)}
        onImport={finish}
      />
      <Sheet open={saving !== null} onOpenChange={(open) => open || setSaving(null)}>
        <SheetPopup anchor={anchor} width={640} aria-label="Save">
          {saving ? (
            <DriveSavePanel
              defaultName={icsFileName(saving.name)}
              defaultFolder="documents"
              defaultExpanded
              onSave={(target) => void save(target)}
              onCancel={() => setSaving(null)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      {drive && opening ? (
        <DriveOpenLayer
          accept={(entry) => isIcsFile({ type: entry.type, name: entry.name })}
          onOpen={(entry) => void fromDrive(entry)}
          onCancel={() => setOpening(false)}
        />
      ) : null}
    </>
  );

  return {
    importFile: (target) => {
      preferred.current = target;
      input.current?.click();
    },
    importFromDrive: (target) => {
      preferred.current = target;
      setOpening(true);
    },
    importEntry: (entry) => void fromDrive(entry),
    exportCalendar: (id) => exporting(() => ofCalendar(id)),
    exportArchive: () => {
      const { events, own } = latest.current;
      try {
        download(archiveText(events, own), archiveFileName(new Date()), "application/json");
      } catch (error) {
        report("The calendars could not be exported.", reason(error));
      }
    },
    exportEvent: (entry) => exporting(() => ofEvent(entry)),
    saveCalendar: (id) => setSaving(ofCalendar(id)),
    saveEvent: (entry) => setSaving(ofEvent(entry)),
    eventFile: (entry) => {
      const name = icsFileName(ofEvent(entry).name);
      return {
        id: `ics:${entry.series ?? entry.id}`,
        name,
        kind: "file",
        type: ICS_TYPE,
        bytes: async () => new Blob([ofEvent(entry).text], { type: ICS_TYPE }),
      };
    },
    elements,
  };
}

/** The sheet that asks where the events of a file go. */
function ImportSheet({
  pending,
  own,
  defaultTarget,
  anchor,
  onCancel,
  onImport,
}: {
  pending: Pending | null;
  own: readonly OwnCalendar[];
  defaultTarget: () => string;
  anchor: SheetPopupProps["anchor"];
  onCancel: () => void;
  onImport: (choice: string) => void;
}) {
  const [choice, setChoice] = useState("");
  const labelId = useId();
  // biome-ignore lint/correctness/useExhaustiveDependencies: chosen afresh for each file.
  useEffect(() => {
    if (!pending) return;
    const wanted = defaultTarget();
    setChoice(own.some((item) => item.id === wanted) ? wanted : (own[0]?.id ?? NEW_CALENDAR));
  }, [pending]);
  const count = pending?.read.events.length ?? 0;
  const newName = pending ? newCalendarName(pending) : "";
  return (
    <Sheet open={pending !== null} onOpenChange={(open) => open || onCancel()}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>Import Events</SheetTitle>
        <SheetDescription>
          Add the {count === 1 ? "event" : `${count} events`} of “{pending?.from}” to a calendar.
        </SheetDescription>
        <div className="mac-calendar-import-form">
          <Label className="mac-calendar-import-label" id={labelId}>
            Add to:
          </Label>
          <PopUpButton
            aria-labelledby={labelId}
            value={choice}
            onValueChange={(value) => setChoice(String(value))}
          >
            {own.map((item) => (
              <PopUpButtonItem key={item.id} value={item.id}>
                {item.name}
              </PopUpButtonItem>
            ))}
            <PopUpButtonSeparator />
            <PopUpButtonItem value={NEW_CALENDAR}>New Calendar “{newName}”</PopUpButtonItem>
          </PopUpButton>
        </div>
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton disabled={choice === ""} onClick={() => onImport(choice)}>
            Import
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** The drive's Open panel, over the page. */
function DriveOpenLayer({
  accept,
  onOpen,
  onCancel,
}: {
  accept: (entry: DriveEntry) => boolean;
  onOpen: (entry: DriveEntry) => void;
  onCancel: () => void;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;
  return createPortal(
    <div className="mac-calendar-panel-layer">
      <DriveOpenPanel
        accept={accept}
        defaultFolder="documents"
        onOpen={onOpen}
        onCancel={onCancel}
      />
    </div>,
    host,
  );
}
