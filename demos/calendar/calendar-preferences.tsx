"use client";

import { Checkbox } from "macalicious/checkbox";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { withClassName } from "macalicious/lib/cn";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowFooter,
  PreferencesWindowForm,
  PreferencesWindowPane,
  type PreferencesWindowProps,
  PreferencesWindowRow,
} from "macalicious/preferences-window";
import { PushButton } from "macalicious/push-button";
import { Separator } from "macalicious/separator";
import { type ReactNode, useId, useState } from "react";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { requestHelp } from "../desktop/desktop-help";
import { servedByDesktopApp, useServerState } from "../desktop/desktop-server";
import { sameDocument } from "../desktop/document-merge";
import { requestPane } from "../system-preferences/pane-request";
import { ALL_DAY_ALERTS, TIMED_ALERTS } from "./calendar-alerts";
import {
  type CalendarSettings,
  calendars,
  defaultSettings as captureSettings,
  hourLabel,
  WEEKDAYS,
} from "./calendar-data";
import {
  AccountsIcon,
  AdvancedIcon,
  AlertsIcon,
  CalendarIcon,
  GeneralIcon,
} from "./calendar-icons";
import {
  ALTERNATE_CALENDARS,
  type AlternateCalendar,
  useAlternateCalendar,
  useAlternateShown,
  useSeparateEvents,
  useWeekNumbers,
  useYearEvents,
} from "./calendar-options";
import { CALENDAR_SETTINGS_URL, settingsFromServer, settingsToServer } from "./calendar-server";
import "./calendar.tokens.css";
import "./calendar-preferences.css";

/*
 * The panes, with the widths of their toolbar items in points, measured on the capture: the
 * label, or the 32 pt icon when that is wider, and 4 to 4.75 pt on each side. They are set
 * because the labels are a little wider in the fallback font, which would move every item
 * after the first.
 */
const PANES: readonly [value: string, title: string, Icon: () => ReactNode, width: number][] = [
  ["general", "General", GeneralIcon, 49],
  ["accounts", "Accounts", AccountsIcon, 56.75],
  ["alerts", "Alerts", AlertsIcon, 40],
  ["advanced", "Advanced", AdvancedIcon, 59.75],
];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOURS_SHOWN = [6, 8, 10, 12, 14, 16, 18, 24];
const SCROLL: readonly [CalendarSettings["scrollBy"], string][] = [
  ["day", "Day"],
  ["week", "Week"],
  ["week-stop-on-today", "Week, Stop on Today"],
];
/** Why Ask before sending changes is dimmed. */
const NO_ASKING =
  "Ask before sending changes: a change reaches the people invited as soon as it is saved, so there is no step to ask at.";
/** Why Time to Leave is dimmed. */
const NO_TIME_TO_LEAVE =
  "Time to Leave needs the time of the trip from a map service, which this desktop does not have. Set an event\u2019s Travel Time in its popover.";
/** The Alerts pane's three menus, with the setting each changes and what it offers. */
const ALERT_MENUS = [
  ["defaultAlert", "Events:", TIMED_ALERTS],
  ["defaultAllDayAlert", "All Day Events:", ALL_DAY_ALERTS],
  ["defaultBirthdayAlert", "Birthdays:", ALL_DAY_ALERTS],
] as const;
/** The one account of Alerts' Account menu. */
const THIS_ACCOUNT = "On This Desktop";

export interface CalendarPreferencesProps
  extends Omit<PreferencesWindowProps, "toolbar" | "children"> {
  /** The settings shown (controlled). Use it with `onSettingsChange`. */
  settings?: CalendarSettings;
  /**
   * The settings at first (uncontrolled).
   * @default defaultSettings
   */
  defaultSettings?: CalendarSettings;
  /** Called with the new settings when a control changes one. */
  onSettingsChange?: (settings: CalendarSettings) => void;
  /**
   * Frame width: a number of points or any CSS length.
   * @default 537
   */
  width?: number | string;
}

/**
 * Calendar's preferences window: the General pane of the capture and the Alerts pane, whose controls
 * read and change a `CalendarSettings` (controlled or not), and small Accounts and Advanced
 * panes, which no capture shows. On the Ferrite desktop the settings are the person's own, kept
 * by Calendar's module (`/api/calendar/settings`): read when the window opens and saved after
 * every change, so that a reload, another browser and a restart keep them. What this Calendar
 * cannot do is shown dimmed, with the reason: Time to Leave, and asking before changes are sent.
 *
 * It is the library's `PreferencesWindow` and takes its props: `state`, `width` (537 pt unless
 * given), `height`, `onClose`, and `value`, `defaultValue` and `onValueChange` for the pane
 * (`"general"`, `"accounts"`, `"alerts"` or `"advanced"`).
 */
export function CalendarPreferences({
  settings: controlled,
  defaultSettings = captureSettings,
  onSettingsChange,
  width = 537,
  className,
  ...props
}: CalendarPreferencesProps) {
  const [own, setOwn] = useState(defaultSettings);
  const settings = controlled ?? own;
  const change = (changed: Partial<CalendarSettings>) => {
    const next = { ...settings, ...changed };
    if (controlled === undefined) setOwn(next);
    onSettingsChange?.(next);
  };
  // The alternate calendar and the view options go with the person's desktop settings.
  const [alternate, setAlternate] = useAlternateCalendar();
  const [alternateShown, setAlternateShown] = useAlternateShown(settings.showAlternateCalendar);
  const [weekNumbers, setWeekNumbers] = useWeekNumbers();
  const [yearEvents, setYearEvents] = useYearEvents();
  const [separateEvents, setSeparateEvents] = useSeparateEvents();
  const id = useId();
  // On the Ferrite desktop: the person's stored settings replace the starting ones, and every
  // change is saved. Until the first load settles the panes are inert, so that no change is made
  // that the load would replace.
  const served = servedByDesktopApp();
  const loading = useServerState({
    url: CALENDAR_SETTINGS_URL,
    enabled: served,
    value: settings,
    onLoad: (stored) => {
      const read = settingsFromServer(stored);
      // Stored settings the window cannot read are not taken, and nothing is saved over them.
      if (read === undefined) return false;
      if (read && !sameDocument(read, settings)) change(read);
    },
    toBody: settingsToServer,
  });
  const busy = (served && loading) || undefined;

  return (
    <PreferencesWindow
      width={width}
      className={withClassName("mac-calendar-preferences", className)}
      toolbar={
        <PreferencesToolbar aria-label="Calendar preferences">
          {PANES.map(([value, title, Icon, width]) => (
            <PreferencesToolbarItem
              key={value}
              value={value}
              icon={<Icon />}
              style={{ width, minWidth: 0, paddingInline: 0 }}
            >
              {title}
            </PreferencesToolbarItem>
          ))}
        </PreferencesToolbar>
      }
      {...props}
    >
      <PreferencesWindowPane value="general" inert={busy}>
        <PreferencesWindowForm className="mac-calendar-preferences-form">
          <PreferencesWindowRow label="Default calendar app:" labelFor={`${id}app`}>
            <PopUpButton
              id={`${id}app`}
              defaultValue="calendar"
              className="mac-calendar-preferences-choice"
            >
              <PopUpButtonItem value="calendar" image={<CalendarIcon />}>
                Calendar
              </PopUpButtonItem>
            </PopUpButton>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Days per week:" labelFor={`${id}days`}>
            <PopUpButton<number>
              id={`${id}days`}
              value={settings.daysPerWeek}
              onValueChange={(value) => value && change({ daysPerWeek: value === 5 ? 5 : 7 })}
              className="mac-calendar-preferences-choice"
            >
              <PopUpButtonItem value={5}>5</PopUpButtonItem>
              <PopUpButtonItem value={7}>7</PopUpButtonItem>
            </PopUpButton>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Start week on:" labelFor={`${id}start`}>
            <PopUpButton<number>
              id={`${id}start`}
              value={settings.weekStartsOn}
              onValueChange={(value) => value !== null && change({ weekStartsOn: value })}
              className="mac-calendar-preferences-choice"
            >
              {WEEKDAYS.map((day, index) => (
                <PopUpButtonItem key={day} value={index}>
                  {day}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Scroll in week view by:" labelFor={`${id}scroll`}>
            <PopUpButton<CalendarSettings["scrollBy"]>
              id={`${id}scroll`}
              value={settings.scrollBy}
              onValueChange={(value) => value && change({ scrollBy: value })}
              className="mac-calendar-preferences-choice"
            >
              {SCROLL.map(([value, title]) => (
                <PopUpButtonItem key={value} value={value}>
                  {title}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PreferencesWindowRow>
          <Separator className="mac-calendar-preferences-rule" />
          <PreferencesWindowRow label="Day starts at:" labelFor={`${id}from`}>
            <PopUpButton<number>
              id={`${id}from`}
              value={settings.dayStartsAt}
              onValueChange={(value) => value !== null && change({ dayStartsAt: value })}
              className="mac-calendar-preferences-choice"
            >
              {HOURS.map((hour) => (
                // A day cannot start after it ends.
                <PopUpButtonItem key={hour} value={hour} disabled={hour >= settings.dayEndsAt}>
                  {hourLabel(hour)}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Day ends at:" labelFor={`${id}to`}>
            <PopUpButton<number>
              id={`${id}to`}
              value={settings.dayEndsAt}
              onValueChange={(value) => value !== null && change({ dayEndsAt: value })}
              className="mac-calendar-preferences-choice"
            >
              {HOURS.map((hour) => (
                <PopUpButtonItem key={hour} value={hour} disabled={hour <= settings.dayStartsAt}>
                  {hourLabel(hour)}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Show:" labelFor={`${id}hours`}>
            <PopUpButton<number>
              id={`${id}hours`}
              aria-describedby={`${id}unit`}
              value={settings.hoursShown}
              onValueChange={(value) => value !== null && change({ hoursShown: value })}
              className="mac-calendar-preferences-number"
            >
              {HOURS_SHOWN.map((hours) => (
                <PopUpButtonItem key={hours} value={hours}>
                  {hours}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
            <Label id={`${id}unit`} className="mac-calendar-preferences-unit">
              hours at a time
            </Label>
          </PreferencesWindowRow>
          <Separator className="mac-calendar-preferences-rule" />
          <PreferencesWindowRow label="Default Calendar:" labelFor={`${id}calendar`}>
            <PopUpButton
              id={`${id}calendar`}
              value={settings.defaultCalendar}
              onValueChange={(value) => value !== null && change({ defaultCalendar: value })}
              className="mac-calendar-preferences-choice"
            >
              <PopUpButtonItem value="selected">Selected calendar</PopUpButtonItem>
              {calendars.map((calendar) => (
                <PopUpButtonItem key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
        <Separator className="mac-calendar-preferences-line" />
        <div className="mac-calendar-preferences-checks">
          <Checkbox
            checked={settings.showBirthdays}
            onCheckedChange={(checked) => change({ showBirthdays: checked })}
          >
            Show Birthdays calendar
          </Checkbox>
          <Checkbox
            checked={settings.showHolidays}
            onCheckedChange={(checked) => change({ showHolidays: checked })}
          >
            Show Holidays calendar
          </Checkbox>
        </div>
        <Separator className="mac-calendar-preferences-line" />
        <PreferencesWindowFooter
          leading={
            <div className="mac-calendar-preferences-alternate">
              <Checkbox
                checked={alternateShown}
                onCheckedChange={(checked) => {
                  setAlternateShown(checked);
                  change({ showAlternateCalendar: checked });
                }}
                className="mac-calendar-preferences-switch"
              >
                Show alternate calendar:
              </Checkbox>
              <PopUpButton<AlternateCalendar>
                aria-label="Alternate calendar"
                disabled={!alternateShown}
                value={alternate}
                onValueChange={(value) => value !== null && setAlternate(value)}
                className="mac-calendar-preferences-choice"
              >
                {ALTERNATE_CALENDARS.map(({ id: calendar, name }) => (
                  <PopUpButtonItem key={calendar} value={calendar}>
                    {name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </div>
          }
        >
          <HelpButton onClick={() => requestHelp("Calendar")} />
        </PreferencesWindowFooter>
      </PreferencesWindowPane>

      <PreferencesWindowPane value="accounts" inert={busy}>
        <div className="mac-calendar-preferences-note">
          <Label color="secondary">
            Your calendars are kept with your account on this desktop. Other calendar accounts
            (iCloud, Google, Exchange) cannot be added.
          </Label>
          <PushButton
            onClick={() => {
              requestPane("internet-accounts");
              requestDesktopEffects([{ open: "system-preferences" }]);
            }}
          >
            Internet Accounts…
          </PushButton>
        </div>
      </PreferencesWindowPane>

      <PreferencesWindowPane value="alerts" keepMounted inert={busy}>
        <PreferencesWindowForm>
          <PreferencesWindowRow label="Account:" labelFor={`${id}account`}>
            <PopUpButton
              id={`${id}account`}
              defaultValue={THIS_ACCOUNT}
              className="mac-calendar-preferences-choice"
            >
              <PopUpButtonItem value={THIS_ACCOUNT}>{THIS_ACCOUNT}</PopUpButtonItem>
            </PopUpButton>
          </PreferencesWindowRow>
          {ALERT_MENUS.map(([setting, label, choices]) => (
            <PreferencesWindowRow key={setting} label={label} labelFor={`${id}${setting}`}>
              <PopUpButton<string>
                id={`${id}${setting}`}
                value={String(settings[setting] ?? "none")}
                onValueChange={(value) =>
                  change({
                    [setting]: value === null || value === "none" ? undefined : Number(value),
                  })
                }
                className="mac-calendar-preferences-choice"
              >
                {choices.map((choice) => (
                  <PopUpButtonItem key={choice.name} value={String(choice.minutes ?? "none")}>
                    {choice.name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </PreferencesWindowRow>
          ))}
          <PreferencesWindowRow>
            <Checkbox disabled aria-describedby={`${id}no-alerts`}>
              Time to Leave
            </Checkbox>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
        <div className="mac-calendar-preferences-note">
          <Label id={`${id}no-alerts`} color="secondary">
            {NO_TIME_TO_LEAVE}
          </Label>
        </div>
      </PreferencesWindowPane>

      <PreferencesWindowPane value="advanced" keepMounted inert={busy}>
        <div className="mac-calendar-preferences-list">
          <Checkbox
            checked={settings.timeZoneSupport === true}
            onCheckedChange={(checked) => change({ timeZoneSupport: checked })}
          >
            Turn on time zone support
          </Checkbox>
          <Checkbox checked={yearEvents} onCheckedChange={(checked) => setYearEvents(checked)}>
            Show events in year view
          </Checkbox>
          <Checkbox checked={weekNumbers} onCheckedChange={(checked) => setWeekNumbers(checked)}>
            Show week numbers
          </Checkbox>
          <Checkbox
            checked={separateEvents}
            onCheckedChange={(checked) => setSeparateEvents(checked)}
          >
            Open events in separate windows
          </Checkbox>
          <Checkbox defaultChecked disabled aria-describedby={`${id}no-advanced`}>
            Ask before sending changes to events
          </Checkbox>
        </div>
        <div className="mac-calendar-preferences-note">
          <Label id={`${id}no-advanced`} color="secondary">
            {NO_ASKING}
          </Label>
        </div>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
