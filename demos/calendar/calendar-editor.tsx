"use client";

import { Checkbox } from "macalicious/checkbox";
import { DatePicker } from "macalicious/date-picker";
import { Label } from "macalicious/label";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuRadioGroup, MenuRadioItem } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonBezel, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { TextView } from "macalicious/text-view";
import { type DragEvent, type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { alertChoices, describeAlert } from "./calendar-alerts";
import { type CalendarEntry, type CalendarInfo, describe, type RepeatRule } from "./calendar-data";
import { EventFileList, useEventUploads } from "./calendar-event-files";
import { describeTravel, TRAVEL_CHOICES } from "./calendar-fields";
import { ColorChip } from "./calendar-icons";
import { InviteesEditor, type InviteesOptions, InviteesSummary } from "./calendar-invitees";
import { daysSpanned, describeRepeat, localZone, REPEAT_CHOICES } from "./calendar-recurrence";
import { changeOfZone, FLOATING, fromWindowClock, ZONES, zoneName } from "./calendar-window-zone";

/** The event's start on its own zone's clock: "9:00 AM GMT+9, Tokyo". */
function zoneReading(start: Date, zone: string): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(start);
  return `${time}, ${zoneName(zone)}`;
}

/** A part of the popover that can be edited. */
export type EventField = "title" | "location" | "date" | "invitees" | "notes";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const REPEAT_UNITS: Record<RepeatRule["freq"], string> = {
  daily: "days",
  weekly: "weeks",
  monthly: "months",
  yearly: "years",
};

export interface EventDetailsProps {
  /** The event as shown: one occurrence of a repeating event, or the event. */
  entry: CalendarEntry;
  /** The calendars the calendar menu offers. */
  calendars: readonly CalendarInfo[];
  /** A calendar's colour. */
  colorOf: (id: string) => string | undefined;
  /** Called with the fields to change, in terms of the event as shown. */
  onChange: (change: Partial<CalendarEntry>) => void;
  /** The part being edited when the popover opens: a new event's title. */
  initialField?: EventField | null;
  /**
   * Inviting other accounts, on the desktop served by the Ferrite application to a signed-in
   * person: the invitees row is then a control. Without it the row only shows, as captured.
   */
  invitees?: InviteesOptions;
  /** Preferences > Advanced: the popover shows and changes the event's time zone. */
  timeZoneSupport?: boolean;
  /** The zone whose clock `entry`'s dates are drawn on, when the toolbar's menu chose one. */
  windowZone?: string | null;
  /** The event's files can be added, on the desktop served by the Ferrite application. */
  canAttach?: boolean;
  /** The event's location, for Maps: on the desktop, the popover offers to show it there. */
  onShowLocation?: (location: string) => void;
}

/** Props that make a row of text open its editor on a click, Return or Space. */
function opener(label: string, open: () => void) {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onClick: open,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    },
  } as const;
}

/** A label and its control on one line of the date editor. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mac-calendar-editor-line">
      <Label color="secondary" align="end" className="mac-calendar-editor-label">
        {label}
      </Label>
      <div className="mac-calendar-editor-control">{children}</div>
    </div>
  );
}

/**
 * The content of Calendar's event popover. As captured it reads the event: its title, "Add
 * Location", the date and "Add Notes, URL, or Attachments". A click on a part opens it for
 * editing, as in Calendar: the title, the location, the date with all-day and repeat, and
 * the notes and URL.
 */
export function EventDetails({
  entry,
  calendars,
  colorOf,
  onChange,
  initialField = null,
  invitees,
  timeZoneSupport = false,
  windowZone,
  canAttach = false,
  onShowLocation,
}: EventDetailsProps) {
  const [field, setField] = useState<EventField | null>(initialField);
  // The occurrences field as typed; the count is set from it when the field is left.
  const [countDraft, setCountDraft] = useState<string | null>(null);
  // The repeat's interval as typed; set from it when the field is left.
  const [intervalDraft, setIntervalDraft] = useState<string | null>(null);
  const [intervalRefused, setIntervalRefused] = useState(false);
  const edit = (next: EventField) => () => setField(next);
  const filePanel = useRef<HTMLInputElement>(null);
  const { upload, uploading, refused } = useEventUploads(entry.attachments, (attachments) =>
    onChange({ attachments }),
  );
  const dropFiles = (event: DragEvent) => {
    if (!canAttach || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    if (event.type === "drop") void upload([...event.dataTransfer.files]);
  };
  const shownZone = entry.floating ? FLOATING : (entry.timeZone ?? localZone());
  const leaveOnKeys = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault();
      setField(null);
    }
  };
  const duration = entry.end.getTime() - entry.start.getTime();

  const setRepeat = (choice: string) => {
    if (choice === "none") onChange({ repeat: undefined, exdates: undefined });
    else onChange({ repeat: { freq: choice as RepeatRule["freq"] } });
  };
  const setRepeatDay = (day: number, on: boolean) => {
    if (!entry.repeat) return;
    const own = entry.start.getDay();
    const now = entry.repeat.days?.length ? entry.repeat.days : [own];
    const next = (on ? [...now, day] : now.filter((each) => each !== day)).sort((a, b) => a - b);
    // A repeat falls on some day: the last one stays ticked.
    if (next.length === 0) return;
    onChange({ repeat: { ...entry.repeat, days: [...new Set(next)] } });
  };
  const repeatEnd =
    entry.repeat?.count !== undefined
      ? "after"
      : entry.repeat?.until !== undefined
        ? "date"
        : "never";
  const setRepeatEnd = (choice: string) => {
    if (!entry.repeat) return;
    const { count: _count, until: _until, ...rule } = entry.repeat;
    if (choice === "after") onChange({ repeat: { ...rule, count: 10 } });
    else if (choice === "date")
      onChange({
        repeat: {
          ...rule,
          until: new Date(
            entry.start.getFullYear(),
            entry.start.getMonth() + 3,
            entry.start.getDate(),
            23,
            59,
          ).getTime(),
        },
      });
    else onChange({ repeat: rule });
  };

  const calendarName = calendars.find((item) => item.id === entry.calendar)?.name ?? "";
  // The alert menu; a value it does not list (one an all-day change left) is offered as it is.
  const choices = alertChoices(entry);
  const alertValue = entry.alert === undefined ? "none" : String(entry.alert);
  const unlisted =
    entry.alert !== undefined && !choices.some((choice) => choice.minutes === entry.alert);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop of files is a shortcut for Add Attachment
    <div className="mac-calendar-details" onDragOver={dropFiles} onDrop={dropFiles}>
      <div className="mac-calendar-popover-head">
        <div className="mac-calendar-popover-name">
          {field === "title" ? (
            <TextField
              aria-label="Title"
              className="mac-calendar-editor-title"
              value={entry.title}
              onValueChange={(title) => onChange({ title })}
              onKeyDown={leaveOnKeys}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : (
            /* 17 pt in the capture: the Title 2 text style. */
            <Label textStyle="title-2" {...opener(`Title: ${entry.title}`, edit("title"))}>
              {entry.title}
            </Label>
          )}
          {field === "location" ? (
            <TextField
              aria-label="Location"
              placeholder="Add Location"
              className="mac-calendar-editor-location"
              value={entry.location ?? ""}
              onValueChange={(location) => onChange({ location })}
              onKeyDown={leaveOnKeys}
              autoFocus
            />
          ) : entry.location ? (
            <div
              className="mac-calendar-popover-location"
              {...opener(`Location: ${entry.location}`, edit("location"))}
            >
              {entry.location}
            </div>
          ) : (
            <div
              className="mac-calendar-popover-hint"
              {...opener("Add Location", edit("location"))}
            >
              Add Location
            </div>
          )}
          {field !== "location" && entry.location && onShowLocation ? (
            <button
              type="button"
              className="mac-calendar-popover-maps"
              onClick={() => onShowLocation(entry.location ?? "")}
            >
              Show in Maps
            </button>
          ) : null}
        </div>
        <Menu>
          <MenuTrigger
            render={
              <PopUpButtonBezel
                size="small"
                arrows="down"
                style={{ width: 38 }}
                aria-label={`Calendar: ${calendarName}`}
                image={<ColorChip color={colorOf(entry.calendar) ?? ""} />}
              />
            }
          />
          <MenuPopup>
            <MenuRadioGroup
              value={entry.calendar}
              onValueChange={(target) => onChange({ calendar: String(target) })}
            >
              {calendars.map((item) => (
                <MenuRadioItem key={item.id} value={item.id}>
                  {item.name}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuPopup>
        </Menu>
      </div>
      {field === "date" ? (
        <div className="mac-calendar-popover-row mac-calendar-editor" data-row="date">
          <Line label="all-day:">
            <Checkbox
              aria-label="All-day"
              checked={entry.allDay === true}
              onCheckedChange={(checked) => {
                const day = new Date(
                  entry.start.getFullYear(),
                  entry.start.getMonth(),
                  entry.start.getDate(),
                );
                if (checked)
                  onChange({
                    allDay: true,
                    start: day,
                    end: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1),
                  });
                else {
                  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9);
                  onChange({
                    allDay: false,
                    start,
                    end: new Date(start.getTime() + 36e5),
                  });
                }
              }}
            />
          </Line>
          <Line label="starts:">
            <DatePicker
              aria-label="Starts"
              size="small"
              stepper={false}
              elements={entry.allDay ? "yearMonthDay" : "yearMonthDay hourMinute"}
              value={entry.start}
              onValueChange={(start) =>
                onChange({
                  start,
                  // An all-day event keeps its number of days, whatever the clocks do between.
                  end: entry.allDay
                    ? new Date(
                        start.getFullYear(),
                        start.getMonth(),
                        start.getDate() + daysSpanned(entry.start, entry.end),
                      )
                    : new Date(start.getTime() + duration),
                })
              }
            />
          </Line>
          <Line label="ends:">
            <DatePicker
              aria-label="Ends"
              size="small"
              stepper={false}
              elements={entry.allDay ? "yearMonthDay" : "yearMonthDay hourMinute"}
              // An all-day event's end is exclusive: the editor shows its last day.
              value={entry.allDay ? new Date(entry.end.getTime() - 1) : entry.end}
              min={entry.start}
              onValueChange={(end) =>
                onChange({
                  end: entry.allDay
                    ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
                    : end,
                })
              }
            />
          </Line>
          {timeZoneSupport && !entry.allDay ? (
            <Line label="time zone:">
              <PopUpButton<string>
                size="small"
                aria-label="Time zone"
                value={shownZone}
                onValueChange={(zone) => {
                  if (zone) onChange(changeOfZone(entry, zone));
                }}
              >
                {[...new Set([localZone(), shownZone, ...ZONES])]
                  .filter((zone) => zone !== FLOATING)
                  .map((zone) => (
                    <PopUpButtonItem key={zone} value={zone}>
                      {zoneName(zone)}
                    </PopUpButtonItem>
                  ))}
                <PopUpButtonItem value={FLOATING}>Floating</PopUpButtonItem>
              </PopUpButton>
            </Line>
          ) : null}
          {entry.allDay ? null : (
            <Line label="travel time:">
              <PopUpButton<string>
                size="small"
                aria-label="Travel time"
                value={String(entry.travelTime ?? "none")}
                onValueChange={(choice) =>
                  onChange({
                    travelTime: choice === null || choice === "none" ? undefined : Number(choice),
                  })
                }
              >
                {TRAVEL_CHOICES.map((choice) => (
                  <PopUpButtonItem key={choice.name} value={String(choice.minutes ?? "none")}>
                    {choice.name}
                  </PopUpButtonItem>
                ))}
                {entry.travelTime && !TRAVEL_CHOICES.some((c) => c.minutes === entry.travelTime) ? (
                  <PopUpButtonItem value={String(entry.travelTime)}>
                    {describeTravel(entry.travelTime)}
                  </PopUpButtonItem>
                ) : null}
              </PopUpButton>
            </Line>
          )}
          <Line label="repeat:">
            <PopUpButton<string>
              size="small"
              aria-label="Repeat"
              value={entry.repeat?.freq ?? "none"}
              onValueChange={(choice) => setRepeat(choice ?? "none")}
            >
              {REPEAT_CHOICES.map((choice) => (
                <PopUpButtonItem key={choice.id} value={choice.id}>
                  {choice.name}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </Line>
          {entry.repeat ? (
            <Line label="every:">
              <TextField
                aria-label="Repeat interval"
                size="small"
                className="mac-calendar-editor-count"
                inputMode="numeric"
                value={intervalDraft ?? String(entry.repeat.interval ?? 1)}
                onValueChange={setIntervalDraft}
                onBlur={() => {
                  if (intervalDraft === null) return;
                  const typed = intervalDraft.trim();
                  const interval = Number(typed);
                  setIntervalDraft(null);
                  // The server keeps 1 to 99: anything else changes nothing, and is said.
                  if (!/^\d+$/.test(typed) || interval < 1 || interval > 99) {
                    setIntervalRefused(true);
                    return;
                  }
                  setIntervalRefused(false);
                  if (!entry.repeat) return;
                  const { interval: _interval, ...rule } = entry.repeat;
                  onChange({ repeat: interval > 1 ? { ...rule, interval } : rule });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
              <Label>{REPEAT_UNITS[entry.repeat.freq]}</Label>
              {intervalRefused ? (
                <Label color="secondary" role="alert">
                  A repeat's interval is 1 to 99.
                </Label>
              ) : null}
            </Line>
          ) : null}
          {entry.repeat?.freq === "weekly" ? (
            <Line label="on:">
              {WEEKDAYS.map((name, day) => (
                <Checkbox
                  key={name}
                  size="small"
                  aria-label={name}
                  checked={(entry.repeat?.days?.length
                    ? entry.repeat.days
                    : [entry.start.getDay()]
                  ).includes(day)}
                  onCheckedChange={(on) => setRepeatDay(day, on === true)}
                >
                  {name[0]}
                </Checkbox>
              ))}
            </Line>
          ) : null}
          {entry.repeat ? (
            <Line label="end repeat:">
              <PopUpButton<string>
                size="small"
                aria-label="End repeat"
                value={repeatEnd}
                onValueChange={(choice) => setRepeatEnd(choice ?? "never")}
              >
                <PopUpButtonItem value="never">Never</PopUpButtonItem>
                <PopUpButtonItem value="after">After</PopUpButtonItem>
                <PopUpButtonItem value="date">On Date</PopUpButtonItem>
              </PopUpButton>
              {repeatEnd === "after" ? (
                <TextField
                  aria-label="Occurrences"
                  size="small"
                  className="mac-calendar-editor-count"
                  inputMode="numeric"
                  value={countDraft ?? String(entry.repeat.count ?? "")}
                  onValueChange={setCountDraft}
                  onBlur={() => {
                    if (countDraft === null) return;
                    const count = Math.min(999, Math.max(1, Number.parseInt(countDraft, 10) || 1));
                    setCountDraft(null);
                    if (entry.repeat) onChange({ repeat: { ...entry.repeat, count } });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
              ) : null}
              {repeatEnd === "date" && entry.repeat.until !== undefined ? (
                <DatePicker
                  aria-label="End repeat date"
                  size="small"
                  stepper={false}
                  elements="yearMonthDay"
                  value={new Date(entry.repeat.until)}
                  min={entry.start}
                  onValueChange={(until) => {
                    if (entry.repeat)
                      onChange({
                        repeat: {
                          ...entry.repeat,
                          until: new Date(
                            until.getFullYear(),
                            until.getMonth(),
                            until.getDate(),
                            23,
                            59,
                            59,
                          ).getTime(),
                        },
                      });
                  }}
                />
              ) : null}
            </Line>
          ) : null}
          <Line label="alert:">
            <PopUpButton<string>
              size="small"
              aria-label="Alert"
              value={alertValue}
              onValueChange={(choice) =>
                choice === null || choice === "none"
                  ? onChange({ alert: undefined, alertDismissed: undefined })
                  : onChange({ alert: Number(choice) })
              }
            >
              {choices.map((choice) => (
                <PopUpButtonItem
                  key={choice.name}
                  value={choice.minutes === null ? "none" : String(choice.minutes)}
                >
                  {choice.name}
                </PopUpButtonItem>
              ))}
              {unlisted && entry.alert !== undefined ? (
                <PopUpButtonItem value={alertValue}>
                  {describeAlert(entry.alert, entry.allDay)}
                </PopUpButtonItem>
              ) : null}
            </PopUpButton>
          </Line>
          <Line label="show as:">
            <PopUpButton<string>
              size="small"
              aria-label="Show as"
              value={entry.showAs ?? "busy"}
              onValueChange={(choice) =>
                onChange({ showAs: choice === "free" ? "free" : undefined })
              }
            >
              <PopUpButtonItem value="busy">Busy</PopUpButtonItem>
              <PopUpButtonItem value="free">Free</PopUpButtonItem>
            </PopUpButton>
          </Line>
          <PushButton
            size="small"
            className="mac-calendar-editor-done"
            onClick={() => setField(null)}
          >
            Done
          </PushButton>
        </div>
      ) : (
        <div
          className="mac-calendar-popover-row"
          {...opener(`Date: ${describe(entry)}`, edit("date"))}
        >
          {describe(entry)}
          {timeZoneSupport && !entry.allDay && entry.timeZone && entry.timeZone !== localZone() ? (
            <div className="mac-calendar-popover-detail" data-row="time-zone">
              {zoneReading(fromWindowClock(entry.start, windowZone ?? null), entry.timeZone)}
            </div>
          ) : null}
          {timeZoneSupport && entry.floating && !entry.allDay ? (
            <div className="mac-calendar-popover-detail" data-row="time-zone">
              Floating
            </div>
          ) : null}
          {entry.repeat ? (
            <div className="mac-calendar-popover-detail">{describeRepeat(entry.repeat)}</div>
          ) : null}
          {entry.alert !== undefined ? (
            <div className="mac-calendar-popover-detail" data-row="alert">
              Alert {describeAlert(entry.alert, entry.allDay)}
            </div>
          ) : null}
          {entry.travelTime && !entry.allDay ? (
            <div className="mac-calendar-popover-detail" data-row="travel">
              Travel time {describeTravel(entry.travelTime)}
            </div>
          ) : null}
          {entry.showAs === "free" ? (
            <div className="mac-calendar-popover-detail" data-row="show-as">
              Show as Free
            </div>
          ) : null}
        </div>
      )}
      {!invitees ? (
        /* The captured popover's invitees row; without the desktop's accounts it only shows. */
        <div className="mac-calendar-popover-row mac-calendar-popover-hint" data-row="invitees">
          Add Invitees
        </div>
      ) : field === "invitees" ? (
        <InviteesEditor
          names={entry.invitees ?? []}
          options={invitees}
          onChange={(names) => onChange({ invitees: names.length ? names : undefined })}
          onDone={() => setField(null)}
        />
      ) : entry.invitees?.length ? (
        <div
          className="mac-calendar-popover-row"
          data-row="invitees"
          {...opener("Invitees", edit("invitees"))}
        >
          <InviteesSummary names={entry.invitees} answers={invitees.answers} />
        </div>
      ) : (
        <div
          className="mac-calendar-popover-row mac-calendar-popover-hint"
          data-row="invitees"
          {...opener("Add Invitees", edit("invitees"))}
        >
          Add Invitees
        </div>
      )}
      {field === "notes" ? (
        <div className="mac-calendar-popover-row mac-calendar-editor" data-row="notes">
          <TextView
            aria-label="Notes"
            placeholder="Add Notes"
            className="mac-calendar-editor-notes"
            value={entry.notes ?? ""}
            onValueChange={(notes) => onChange({ notes })}
            autoFocus
          />
          <TextField
            aria-label="URL"
            placeholder="Add URL"
            type="url"
            size="small"
            value={entry.url ?? ""}
            onValueChange={(url) => onChange({ url })}
            onKeyDown={leaveOnKeys}
          />
          {entry.attachments?.length ? (
            <EventFileList
              files={entry.attachments}
              onRemove={(gone) =>
                onChange({
                  attachments: entry.attachments?.filter((file) => file.id !== gone.id),
                })
              }
            />
          ) : null}
          {canAttach ? (
            <>
              <input
                ref={filePanel}
                type="file"
                multiple
                hidden
                aria-label="Attachment file"
                onChange={(event) => {
                  const chosen = [...(event.currentTarget.files ?? [])];
                  event.currentTarget.value = "";
                  void upload(chosen);
                }}
              />
              <PushButton size="small" onClick={() => filePanel.current?.click()}>
                Add Attachment…
              </PushButton>
              {uploading > 0 ? <Label color="secondary">Attaching…</Label> : null}
              {refused ? (
                <Label role="alert" color="secondary">
                  {refused}
                </Label>
              ) : null}
            </>
          ) : null}
          <PushButton
            size="small"
            className="mac-calendar-editor-done"
            onClick={() => setField(null)}
          >
            Done
          </PushButton>
        </div>
      ) : entry.notes || entry.url || entry.attachments?.length ? (
        <div
          className="mac-calendar-popover-row"
          data-row="notes"
          {...opener("Notes", edit("notes"))}
        >
          {entry.notes ? <div className="mac-calendar-popover-notes">{entry.notes}</div> : null}
          {entry.url ? (
            <a
              className="mac-calendar-popover-url"
              href={entry.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(event) => event.stopPropagation()}
            >
              {entry.url}
            </a>
          ) : null}
          {entry.attachments?.length ? <EventFileList files={entry.attachments} /> : null}
        </div>
      ) : (
        <div
          className="mac-calendar-popover-row mac-calendar-popover-hint"
          data-row="notes"
          {...opener("Add Notes, URL, or Attachments", edit("notes"))}
        >
          Add Notes, URL, or Attachments
        </div>
      )}
    </div>
  );
}
