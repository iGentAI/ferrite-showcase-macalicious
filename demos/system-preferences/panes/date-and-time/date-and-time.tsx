"use client";

import { Checkbox } from "macalicious/checkbox";
import { ComboBox, ComboBoxItem } from "macalicious/combo-box";
import { DatePicker, DatePickerCalendar, DatePickerClock } from "macalicious/date-picker";
import { EmptyState } from "macalicious/empty-state";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { LockButton } from "macalicious/lock-button";
import { PushButton } from "macalicious/push-button";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference, usePreferences } from "../../pane";
import { Uncaptured } from "../uncaptured";

/**
 * The tab view's top-left corner in the window frame: the strip is centred on the box's top
 * edge, which is at y 72.
 */
const TABS = { x: 20, y: 62 };

const DAY = 86_400_000;

/** 3 October 2019 and 10:56:59 AM, the date and the time of the light capture. */
const CAPTURED_DAY = Date.UTC(2019, 9, 3) / DAY;
const CAPTURED_TIME = 10 * 3600 + 56 * 60 + 59;

/**
 * A date picker's width for a field of the measured width: the field takes what its stepper,
 * 13 pt, and the 3.5 pt before it leave.
 */
const withField = (field: number) => ({ width: field + 16.5 });

/** The time servers of Catalina's list; the first is the one of both captures. */
const SERVERS = [
  "Apple Americas/U.S. (time.apple.com.)",
  "Apple Asia (time.asia.apple.com.)",
  "Apple Europe (time.euro.apple.com.)",
];

/**
 * The settings keep the day (days since 1 January 1970) and the time of day (seconds since
 * midnight) apart, and so do the controls: the date field and the calendar get the day at
 * local noon, which no daylight-saving change skips, and the time field and the clock get the
 * time on a fixed reference day, 1 January 2001 (the date picker's own reference, on which no
 * time zone changes its clock). A time the day's own clock skips, such as 2:30 on a
 * spring-forward day, is therefore shown and kept as set. The years are set with
 * `setFullYear` and `setUTCFullYear`, which, unlike the `Date` constructor and `Date.UTC`, do
 * not read years 0 to 99 as 1900 to 1999.
 */
const dateOf = (day: number) => {
  const utc = new Date(day * DAY);
  const date = new Date(2001, 0, 1, 12);
  date.setFullYear(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  return date;
};
const dayOf = (date: Date) => {
  const utc = new Date(0);
  utc.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round(utc.getTime() / DAY);
};
const timeDateOf = (time: number) =>
  new Date(2001, 0, 1, Math.floor(time / 3600), Math.floor(time / 60) % 60, time % 60);
const timeOf = (date: Date) => date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();

/**
 * System Preferences > Date & Time: the Date & Time tab. The pane opens locked, with the date
 * and the time set automatically, so its form is disabled as in the capture; the lock opens
 * without asking for a password, and with the checkbox off the date and the time can be set
 * in the fields, with their steppers and on the calendar. The fields, the calendar and the clock
 * are the library's date picker, the time server the library's combo box. Nothing here reads or
 * sets the real clock.
 *
 * Distances are those of reference/spec/apps/system-preferences-date-and-time.md, in points
 * from the top-left corner of the window frame.
 */
export function DateAndTime() {
  const { showPane } = usePreferences();
  const [tab, setTab] = usePreference<string>("date-and-time.tab", "date-and-time");
  const [locked, setLocked] = usePreference("date-and-time.locked", true);
  const [automatic, setAutomatic] = usePreference("date-and-time.automatic", true);
  const [day, setDay] = usePreference("date-and-time.date", CAPTURED_DAY);
  const [time, setTime] = usePreference("date-and-time.time", CAPTURED_TIME);
  const [server, setServer] = usePreference("date-and-time.server", SERVERS[0] as string);
  const fixed = locked || automatic;
  const date = dateOf(day);
  const setDate = (next: Date) => setDay(dayOf(next));
  const clock = timeDateOf(time);
  const setClock = (next: Date) => setTime(timeOf(next));

  return (
    <>
      <TabView
        value={tab}
        onValueChange={(value) => setTab(value as string)}
        style={{ position: "absolute", left: TABS.x, top: TABS.y - 38, width: 628, height: 396 }}
      >
        <TabViewList aria-label="Date & Time">
          <TabViewTab value="date-and-time" style={{ width: 99, padding: 0 }}>
            Date & Time
          </TabViewTab>
          <TabViewTab value="time-zone" style={{ width: 87, padding: 0 }}>
            Time Zone
          </TabViewTab>
          <TabViewTab value="clock" style={{ width: 59, padding: 0 }}>
            Clock
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="date-and-time">
          <PaneForm origin={TABS}>
            <PaneAt x={77} y={111}>
              <Checkbox checked={automatic} onCheckedChange={setAutomatic} disabled={locked}>
                Set date and time automatically:
              </Checkbox>
            </PaneAt>
            {/* The time server: used while the date and the time are set automatically. */}
            <PaneAt x={298.5} y={109.5}>
              <ComboBox
                aria-label="Time server"
                value={server}
                onValueChange={setServer}
                disabled={locked || !automatic}
                style={{ width: 275 }}
              >
                {SERVERS.map((entry) => (
                  <ComboBoxItem key={entry} value={entry}>
                    {entry}
                  </ComboBoxItem>
                ))}
              </ComboBox>
            </PaneAt>

            {/* The date: the field and its stepper, then the calendar under them. */}
            <PaneAt x={181} y={158.5}>
              <DatePicker
                aria-label="Date"
                elements="yearMonthDay"
                value={date}
                onValueChange={setDate}
                disabled={fixed}
                style={withField(79.5)}
              />
            </PaneAt>
            <PaneAt x={159.5} y={190.5}>
              <DatePickerCalendar
                aria-label="Calendar"
                value={date}
                onValueChange={setDate}
                disabled={fixed}
              />
            </PaneAt>

            {/* The time: the field and its stepper, then the clock under them. */}
            <PaneAt x={399} y={158.5}>
              <DatePicker
                aria-label="Time"
                elements="hourMinuteSecond"
                value={clock}
                onValueChange={setClock}
                disabled={fixed}
                style={withField(85.5)}
              />
            </PaneAt>
            <PaneAt x={390} y={207}>
              <DatePickerClock value={clock} />
            </PaneAt>

            <PaneAt x={57.5} y={411}>
              <Label textStyle="small">
                To set date and time formats, use Language & Region preferences.
              </Label>
            </PaneAt>
            <PaneAt x={415} y={409}>
              <PushButton
                size="small"
                style={{ minWidth: 159 }}
                onClick={() => showPane("language-and-region")}
              >
                Open Language & Region…
              </PushButton>
            </PaneAt>
          </PaneForm>
        </TabViewPanel>
        <TabViewPanel value="time-zone">
          <EmptyState>The Time Zone tab is not part of this demo.</EmptyState>
        </TabViewPanel>
        <TabViewPanel value="clock">
          <EmptyState>The Clock tab is not part of this demo.</EmptyState>
        </TabViewPanel>
      </TabView>

      <PaneFooter x={25.5} y={482.5}>
        {/* Catalina asks for an administrator's password in a sheet before it unlocks. */}
        <LockButton state={locked ? "locked" : "unlocked"} onClick={() => setLocked(!locked)} />
      </PaneFooter>
      <PaneFooter right={20} y={491}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </>
  );
}
