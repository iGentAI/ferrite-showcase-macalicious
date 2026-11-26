"use client";

import { Checkbox } from "macalicious/checkbox";
import { DatePicker } from "macalicious/date-picker";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { Popover, PopoverPopup, PopoverSeparator, PopoverTitle } from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { type ChangeEvent, type CSSProperties, useId, useState } from "react";
import { useContactPeople } from "../contacts/contacts-people";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { askMapsSearch } from "../maps/maps-open";
import { FlagGlyph, PictureGlyph } from "./reminders-artwork";
import {
  dayOf,
  EARLY_MINUTES,
  PRIORITIES,
  REPEATS,
  type Reminder,
  type ReminderPriority,
  type ReminderRepeat,
} from "./reminders-data";
import { dateOf, nextOccurrence, timeOf } from "./reminders-dates";
import {
  attachPicture,
  changeReminderDetail,
  reminderDetail,
  reminderPictures,
  removeReminderPicture,
  useDetailsVersion,
} from "./reminders-details";
import { changeOfPlace, useLocationHint } from "./reminders-location";
import { FIRST_RULE, RepeatRuleRows } from "./reminders-repeat";
import { useReminderFieldTyping } from "./reminders-text-tools";

/** Why no person can be chosen. */
export const NO_PEOPLE = "No one in Contacts has an account on this desktop.";

/** Why Show in Maps is dimmed outside a desktop. */
export const NO_MAPS = "Maps opens only on the desktop.";

/** An early reminder's choice, as the info popover says it. */
const earlyLabel = (minutes: number) =>
  minutes === 1440
    ? "1 day before"
    : minutes >= 60
      ? `${minutes / 60} ${minutes === 60 ? "hour" : "hours"} before`
      : `${minutes} minutes before`;

/** The popover's content reaches its edges: the separators are inset by the layout. */
const POPUP = { "--mac-popover-padding": "0px" } as CSSProperties;

/**
 * The priority's arrows: in the title's colour while the stylesheet leaves `--_resting-arrow`
 * unset (under the pointer, with the focus, while open), transparent otherwise.
 */
const PRIORITY = {
  "--mac-pop-up-button-borderless-arrow-color": "var(--_resting-arrow)",
} as CSSProperties;

/** As POPUP, with the material as captured: `#f2f2f2` and `#282828` over any backdrop. */
const POPUP_OPAQUE = {
  ...POPUP,
  "--mac-material-popover": "var(--mac-material-popover-opaque)",
} as CSSProperties;

/** The minute "At a Time" starts at: the minute a reminder without one alerts. */
const DEFAULT_TIME = "09:00";

export interface ReminderInfoProps {
  /** Whether a desktop hosts the window, where Maps can be opened. */
  inDesktop?: boolean;
  /** The reminder whose details are shown and changed. */
  reminder: Reminder;
  /** What the popover's arrow points at: the info mark of the reminder's row. */
  anchor: Element | null;
  /** The day "On a Day" sets the reminder due: today, as `YYYY-MM-DD`. */
  today: string;
  /** Called with the fields to change, as soon as a control changes. */
  onChange: (change: Partial<Reminder>) => void;
  /** Called when the popover is dismissed: Escape, or a press outside it. */
  onClose: (event: Event | undefined) => void;
  /**
   * The popover's surface: the translucent material, or its opaque form, the colour the
   * captures record.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
}

/**
 * The info popover of a reminder: its title with a flag button, notes, the "remind me"
 * checkboxes (On a Day with its date and At a Time with its minute), the repeat and its end for a
 * reminder with a day, the priority, a URL and the attached pictures. It is open while it is
 * rendered, beside its anchor, and every change goes to `onChange` at once.
 */
export function ReminderInfo({
  reminder,
  anchor,
  today,
  inDesktop = false,
  onChange,
  onClose,
  material = "translucent",
}: ReminderInfoProps) {
  const id = useId();
  const images = reminder.images ?? 0;
  const { due, dueTime, repeat, repeatRule, repeatEnd } = reminder;
  useDetailsVersion();
  const detail = reminderDetail(reminder.id);
  const locationHint = useLocationHint(detail);
  const pictures = reminderPictures(reminder.id);
  const typing = useReminderFieldTyping();
  const served = servedByDesktopApp();
  const people = useContactPeople(served && reminder.whenMessaging === true);
  const [shownImage, setShownImage] = useState(1);
  const [pictureProblem, setPictureProblem] = useState<string | null>(null);
  const addPicture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const problem = await attachPicture(reminder.id, file);
    setPictureProblem(problem);
    if (!problem) {
      onChange({ images: images + 1 });
      setShownImage(images + 1);
    }
  };
  return (
    <Popover
      open
      onOpenChange={(open, details) => {
        if (!open) onClose(details?.event);
      }}
    >
      {/* The arrow's tip is a quarter point over the centre of the mark, as captured. */}
      <PopoverPopup
        side="right"
        alignOffset={-0.25}
        anchor={anchor}
        className="mac-reminders-info"
        style={material === "opaque" ? POPUP_OPAQUE : POPUP}
      >
        <div className="mac-reminders-info-head">
          <PopoverTitle className="mac-reminders-info-title">{reminder.title}</PopoverTitle>
          <PushButton
            compact
            className="mac-reminders-info-flag"
            aria-label="Flag"
            aria-pressed={reminder.flagged === true}
            onClick={() => onChange({ flagged: !reminder.flagged })}
          >
            <FlagGlyph />
          </PushButton>
        </div>
        <TextField
          bezel="none"
          className="mac-reminders-info-notes"
          aria-label="Notes"
          placeholder="Notes"
          value={reminder.notes ?? ""}
          spellCheck={typing.spellCheck}
          onInput={typing.onInput}
          onValueChange={(notes) => onChange({ notes })}
        />
        <PopoverSeparator className="mac-reminders-info-line" />
        <div className="mac-reminders-info-row" data-row="remind">
          <Label id={`${id}r`} color="secondary" align="end" className="mac-reminders-info-lead">
            remind me
          </Label>
          {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend's layout; the label beside the group names it */}
          <div role="group" aria-labelledby={`${id}r`} className="mac-reminders-info-choices">
            <Checkbox
              checked={due !== undefined}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? { due: today }
                    : {
                        due: undefined,
                        dueTime: undefined,
                        repeat: undefined,
                        repeatRule: undefined,
                        repeatEnd: undefined,
                      },
                )
              }
            >
              On a Day
            </Checkbox>
            {due !== undefined ? (
              <>
                <DatePicker
                  aria-label="Date"
                  className="mac-reminders-info-date"
                  elements="yearMonthDay"
                  stepper={false}
                  value={dateOf(due)}
                  onValueChange={(date) => onChange({ due: dayOf(date) })}
                />
                <Checkbox
                  checked={dueTime !== undefined}
                  onCheckedChange={(checked) =>
                    onChange({ dueTime: checked ? DEFAULT_TIME : undefined })
                  }
                >
                  At a Time
                </Checkbox>
                {dueTime !== undefined ? (
                  <DatePicker
                    aria-label="Time"
                    className="mac-reminders-info-date"
                    elements="hourMinute"
                    stepper={false}
                    value={dateOf(due, dueTime)}
                    onValueChange={(date) => onChange({ dueTime: timeOf(date) })}
                  />
                ) : null}
                {dueTime !== undefined ? (
                  <PopUpButton<number>
                    aria-label="Early Reminder"
                    value={reminder.earlyMinutes ?? 0}
                    onValueChange={(minutes) =>
                      onChange({ earlyMinutes: minutes ? minutes : undefined })
                    }
                  >
                    <PopUpButtonItem value={0}>No early reminder</PopUpButtonItem>
                    {EARLY_MINUTES.map((minutes) => (
                      <PopUpButtonItem key={minutes} value={minutes}>
                        {earlyLabel(minutes)}
                      </PopUpButtonItem>
                    ))}
                  </PopUpButton>
                ) : null}
              </>
            ) : null}
            <Checkbox
              checked={reminder.atLocation === true}
              onCheckedChange={(checked) => onChange({ atLocation: checked })}
            >
              At a Location
            </Checkbox>
            {reminder.atLocation ? (
              <>
                <TextField
                  aria-label="Location"
                  placeholder="Enter a Location"
                  value={detail.place ?? ""}
                  onValueChange={(place) => changeReminderDetail(reminder.id, changeOfPlace(place))}
                />
                <PopUpButton<string>
                  aria-label="Alert at the location"
                  value={detail.leaving ? "leaving" : "arriving"}
                  onValueChange={(when) =>
                    changeReminderDetail(reminder.id, { leaving: when === "leaving" })
                  }
                >
                  <PopUpButtonItem value="arriving">Arriving</PopUpButtonItem>
                  <PopUpButtonItem value="leaving">Leaving</PopUpButtonItem>
                </PopUpButton>
                <PushButton
                  compact
                  disabled={!inDesktop || !detail.place}
                  title={inDesktop ? undefined : NO_MAPS}
                  onClick={() => askMapsSearch(detail.place ?? "")}
                >
                  Show in Maps
                </PushButton>
                <Label color="secondary" className="mac-reminders-info-hint">
                  {locationHint}
                </Label>
              </>
            ) : null}
            <Checkbox
              checked={reminder.whenMessaging === true}
              onCheckedChange={(checked) => onChange({ whenMessaging: checked })}
            >
              When Messaging a Person
            </Checkbox>
            {reminder.whenMessaging ? (
              people.length > 0 || detail.person ? (
                <PopUpButton<string>
                  aria-label="Person"
                  value={detail.person?.to ?? ""}
                  onValueChange={(to) =>
                    changeReminderDetail(reminder.id, {
                      person: people.find((each) => each.to === to) ?? detail.person,
                    })
                  }
                >
                  {detail.person ? null : <PopUpButtonItem value="">Add Contact</PopUpButtonItem>}
                  {detail.person && !people.some((each) => each.to === detail.person?.to) ? (
                    <PopUpButtonItem value={detail.person.to}>{detail.person.name}</PopUpButtonItem>
                  ) : null}
                  {people.map((each) => (
                    <PopUpButtonItem key={each.to} value={each.to}>
                      {each.name}
                    </PopUpButtonItem>
                  ))}
                </PopUpButton>
              ) : (
                <Label
                  color="secondary"
                  className="mac-reminders-info-hint"
                  title={served ? NO_PEOPLE : undefined}
                >
                  Add Contact
                </Label>
              )
            ) : null}
          </div>
        </div>
        {due !== undefined ? (
          <>
            <PopoverSeparator className="mac-reminders-info-line" />
            <div className="mac-reminders-info-row" data-row="repeat">
              <Label id={`${id}e`} color="secondary" align="end">
                repeat
              </Label>
              <PopUpButton<ReminderRepeat | "never">
                bordered={false}
                className="mac-reminders-info-repeat"
                style={PRIORITY}
                aria-labelledby={`${id}e`}
                value={repeat ?? "never"}
                onValueChange={(next) =>
                  onChange(
                    !next || next === "never"
                      ? { repeat: undefined, repeatRule: undefined, repeatEnd: undefined }
                      : next === "custom"
                        ? { repeat: next, repeatRule: repeatRule ?? FIRST_RULE }
                        : { repeat: next, repeatRule: undefined },
                  )
                }
              >
                {REPEATS.map((item) => (
                  <PopUpButtonItem key={item.id} value={item.id}>
                    {item.name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </div>
            {repeat === "custom" && repeatRule ? (
              <RepeatRuleRows rule={repeatRule} due={due} onChange={onChange} />
            ) : null}
            {repeat !== undefined ? (
              <div className="mac-reminders-info-row" data-row="end-repeat">
                <Label id={`${id}n`} color="secondary" align="end">
                  end repeat
                </Label>
                <div className="mac-reminders-info-end">
                  <PopUpButton<"never" | "date">
                    bordered={false}
                    className="mac-reminders-info-repeat"
                    style={PRIORITY}
                    aria-labelledby={`${id}n`}
                    value={repeatEnd === undefined ? "never" : "date"}
                    onValueChange={(next) =>
                      onChange({
                        // On Date starts a month after the due day.
                        repeatEnd:
                          next === "date" ? (nextOccurrence(due, "monthly") ?? due) : undefined,
                      })
                    }
                  >
                    <PopUpButtonItem value="never">Never</PopUpButtonItem>
                    <PopUpButtonItem value="date">On Date</PopUpButtonItem>
                  </PopUpButton>
                  {repeatEnd !== undefined ? (
                    <DatePicker
                      aria-label="End Date"
                      className="mac-reminders-info-date"
                      elements="yearMonthDay"
                      stepper={false}
                      value={dateOf(repeatEnd)}
                      onValueChange={(date) => onChange({ repeatEnd: dayOf(date) })}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        <PopoverSeparator className="mac-reminders-info-line" />
        <div className="mac-reminders-info-row" data-row="priority">
          <Label id={`${id}p`} color="secondary" align="end">
            priority
          </Label>
          <PopUpButton<ReminderPriority>
            bordered={false}
            className="mac-reminders-info-priority"
            style={PRIORITY}
            aria-labelledby={`${id}p`}
            value={reminder.priority ?? "none"}
            onValueChange={(priority) => onChange({ priority: priority ?? "none" })}
          >
            {PRIORITIES.map((priority) => (
              <PopUpButtonItem key={priority.id} value={priority.id}>
                {priority.name}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </div>
        <PopoverSeparator className="mac-reminders-info-line" />
        <div className="mac-reminders-info-row" data-row="url">
          <Label id={`${id}u`} color="secondary" align="end">
            URL
          </Label>
          <TextField
            bezel="none"
            className="mac-reminders-info-url"
            aria-labelledby={`${id}u`}
            placeholder="None"
            type="url"
            value={reminder.url ?? ""}
            onValueChange={(url) => onChange({ url })}
          />
        </div>
        <div className="mac-reminders-info-row" data-row="images">
          <Label id={`${id}i`} color="secondary" align="end">
            images
          </Label>
          <div className="mac-reminders-info-images">
            {images > 0 ? (
              <PopUpButton<number>
                className="mac-reminders-info-image"
                arrows="down"
                aria-labelledby={`${id}i`}
                value={Math.min(shownImage, images)}
                onValueChange={(next) => {
                  if (next === null) return;
                  if (next !== 0) {
                    setShownImage(next);
                    return;
                  }
                  const gone = Math.min(shownImage, images) - 1;
                  removeReminderPicture(reminder.id, gone);
                  onChange({ images: images > 1 ? images - 1 : undefined });
                  setShownImage(1);
                }}
              >
                {Array.from({ length: images }, (_, index) => (
                  <PopUpButtonItem
                    // biome-ignore lint/suspicious/noArrayIndexKey: the pictures are known only by their number
                    key={index}
                    value={index + 1}
                    image={
                      pictures[index] ? (
                        <img className="mac-reminders-picture" src={pictures[index]} alt="" />
                      ) : (
                        <PictureGlyph />
                      )
                    }
                  >
                    {images > 1 ? `Image ${index + 1}` : "Image"}
                  </PopUpButtonItem>
                ))}
                <PopUpButtonItem value={0}>Remove Image</PopUpButtonItem>
              </PopUpButton>
            ) : null}
            <input
              id={`${id}f`}
              type="file"
              accept="image/*"
              hidden
              aria-label="Image file"
              onChange={(event) => void addPicture(event)}
            />
            <PushButton
              className="mac-reminders-info-add"
              onClick={() => document.getElementById(`${id}f`)?.click()}
            >
              Add Image…
            </PushButton>
            {pictureProblem ? (
              <Label role="status" color="secondary" className="mac-reminders-info-hint">
                {pictureProblem}
              </Label>
            ) : null}
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
