"use client";

import { Checkbox } from "macalicious/checkbox";
import { DatePicker } from "macalicious/date-picker";
import { DefaultButton } from "macalicious/default-button";
import { Form, FormRow } from "macalicious/form";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetPopup,
  type SheetPopupProps,
  SheetTitle,
} from "macalicious/sheet";
import { useState } from "react";
import { printDocument, printPage } from "../textedit/textedit-drive";
import { type CalendarEntry, dayAt } from "./calendar-data";
import {
  agendaLines,
  type PrintCalendar,
  type PrintOptions,
  type PrintSize,
  type PrintView,
  printHtml,
  printSpan,
} from "./calendar-print";

const VIEWS: readonly { value: PrintView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "list", label: "List" },
];
const SIZES: readonly { value: PrintSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "big", label: "Big" },
];

/** Hands the pages to the browser's print dialog, where Save as PDF writes them to a file. */
export function printCalendar(
  entries: readonly CalendarEntry[],
  calendars: readonly PrintCalendar[],
  options: PrintOptions,
) {
  printDocument({
    name: "Calendar",
    plain: false,
    lines: agendaLines(entries, options.from, options.until),
    html: printHtml(entries, calendars, options),
  });
}

/**
 * File > Print: which view, days and calendars, what each page shows, and a preview of the first
 * pages. Continue goes on to the browser's print dialog, as Calendar's goes on to the Mac's.
 */
export function CalendarPrintSheet({
  anchor,
  initial,
  calendars,
  shownCalendars,
  entriesFor,
  onClose,
}: {
  anchor: SheetPopupProps["anchor"];
  /** The view and days the window shows. */
  initial: PrintOptions;
  calendars: readonly PrintCalendar[];
  /** The ids of the calendars ticked at first: those the window shows. */
  shownCalendars: readonly string[];
  /** The occurrences of `ids`' events from `from` until before `until`. */
  entriesFor: (ids: readonly string[], from: Date, until: Date) => readonly CalendarEntry[];
  onClose: () => void;
}) {
  const [options, setOptions] = useState(initial);
  const [starts, setStarts] = useState(initial.from);
  const [ends, setEnds] = useState(dayAt(initial.until, -1));
  const [ticked, setTicked] = useState<readonly string[]>(shownCalendars);
  const change = (more: Partial<PrintOptions>) => setOptions((now) => ({ ...now, ...more }));
  const [from, until] = printSpan(options.view, starts, ends, options.weekStartsOn);
  const final = { ...options, from, until };
  const chosen = calendars.filter(({ id }) => ticked.includes(id));
  const entries = entriesFor(ticked, from, until);
  const preview = printPage({
    name: "Calendar",
    plain: false,
    lines: [],
    html: `<style>html{zoom:.45}</style>${printHtml(entries, chosen, final)}`,
  });
  const tick = (
    label: string,
    key: "allDay" | "timed" | "miniCalendar" | "keys" | "blackAndWhite",
  ) => (
    <Checkbox checked={options[key]} onCheckedChange={(on) => change({ [key]: on === true })}>
      {label}
    </Checkbox>
  );
  return (
    <Sheet open onOpenChange={(open) => open || onClose()}>
      <SheetPopup anchor={anchor} width={640} aria-label="Print">
        <SheetTitle>Print</SheetTitle>
        <div className="mac-calendar-print">
          <iframe
            className="mac-calendar-print-preview"
            title="Preview"
            sandbox=""
            srcDoc={preview}
            tabIndex={-1}
          />
          <div className="mac-calendar-print-settings">
            <Form render={<div />} labelWidth={80}>
              <FormRow label="View:" align="center">
                <PopUpButton
                  aria-label="View"
                  value={options.view}
                  onValueChange={(view) => change({ view: view as PrintView })}
                >
                  {VIEWS.map(({ value, label }) => (
                    <PopUpButtonItem key={value} value={value}>
                      {label}
                    </PopUpButtonItem>
                  ))}
                </PopUpButton>
              </FormRow>
              <FormRow label="Starts:" align="center">
                <DatePicker
                  aria-label="Print starts"
                  size="small"
                  elements="yearMonthDay"
                  value={starts}
                  onValueChange={setStarts}
                />
              </FormRow>
              <FormRow label="Ends:" align="center">
                <DatePicker
                  aria-label="Print ends"
                  size="small"
                  elements="yearMonthDay"
                  value={ends}
                  onValueChange={setEnds}
                />
              </FormRow>
              <FormRow label="Text Size:" align="center">
                <PopUpButton
                  aria-label="Text Size"
                  value={options.textSize}
                  onValueChange={(textSize) => change({ textSize: textSize as PrintSize })}
                >
                  {SIZES.map(({ value, label }) => (
                    <PopUpButtonItem key={value} value={value}>
                      {label}
                    </PopUpButtonItem>
                  ))}
                </PopUpButton>
              </FormRow>
            </Form>
            <fieldset aria-label="Calendars" className="mac-calendar-print-list">
              <Label color="secondary">Calendars:</Label>
              {calendars.map(({ id, name }) => (
                <Checkbox
                  key={id}
                  checked={ticked.includes(id)}
                  onCheckedChange={(on) =>
                    setTicked((now) =>
                      on === true ? [...now, id] : now.filter((each) => each !== id),
                    )
                  }
                >
                  {name}
                </Checkbox>
              ))}
            </fieldset>
            <fieldset aria-label="Options" className="mac-calendar-print-list">
              <Label color="secondary">Options:</Label>
              {tick("All-day events", "allDay")}
              {tick("Timed events", "timed")}
              {tick("Mini calendar", "miniCalendar")}
              {tick("Calendar keys", "keys")}
              {tick("Black and white", "blackAndWhite")}
            </fieldset>
          </div>
        </div>
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton
            onClick={() => {
              printCalendar(entries, chosen, final);
              onClose();
            }}
          >
            Continue
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
