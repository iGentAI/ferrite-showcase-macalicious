"use client";

import { Checkbox } from "macalicious/checkbox";
import { DatePicker, DatePickerCalendar, DatePickerClock } from "macalicious/date-picker";
import { Label } from "macalicious/label";
import { LockButton } from "macalicious/lock-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { useEffect, useState } from "react";
import { PaneChoice } from "../../choice";
import { PaneFooter } from "../../form";
import { usePreference } from "../../pane";
import { OpenPane, ServedPage } from "../../served-pages";
import {
  ANNOUNCE_EVERY,
  CLOCK_AM_PM_KEY,
  CLOCK_ANALOG_KEY,
  CLOCK_ANNOUNCE_EVERY_KEY,
  CLOCK_ANNOUNCE_KEY,
  CLOCK_DATE_KEY,
  CLOCK_FLASH_KEY,
  CLOCK_HOUR24_KEY,
  CLOCK_SECONDS_KEY,
  CLOCK_SHOW_KEY,
  CLOCK_WEEKDAY_KEY,
  useHasVoice,
} from "./menu-clock";

const CANNOT_SET = "A web page cannot set your computer's clock.";
const NO_ADMINISTRATOR = "Nothing on this desktop's Date & Time needs an administrator.";

/** The time now, read again each second. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const noChange = () => {};

function Today({ now }: { now: Date }) {
  return (
    <div
      title={CANNOT_SET}
      style={{ display: "flex", justifyContent: "center", gap: 60, alignItems: "start" }}
    >
      <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
        <DatePicker
          aria-label="Date"
          elements="yearMonthDay"
          value={now}
          onValueChange={noChange}
          disabled
        />
        <DatePickerCalendar aria-label="Calendar" value={now} onValueChange={noChange} disabled />
      </div>
      <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
        <DatePicker
          aria-label="Time"
          elements="hourMinuteSecond"
          value={now}
          onValueChange={noChange}
          disabled
        />
        <DatePickerClock value={now} />
      </div>
    </div>
  );
}

function Setting({
  setting,
  initial = false,
  disabled,
  children,
}: {
  setting: string;
  initial?: boolean;
  disabled?: boolean;
  children: string;
}) {
  const [on, setOn] = usePreference(setting, initial);
  return (
    <Checkbox checked={on} onCheckedChange={setOn} disabled={disabled}>
      {children}
    </Checkbox>
  );
}

/** The Clock tab: what the menu bar clock shows, which `menu-clock.ts` follows. */
function ClockSettings() {
  const [shown, setShown] = usePreference(CLOCK_SHOW_KEY, true);
  const [analog, setAnalog] = usePreference(CLOCK_ANALOG_KEY, false);
  const [hour24, setHour24] = usePreference(CLOCK_HOUR24_KEY, false);
  const [announce, setAnnounce] = usePreference(CLOCK_ANNOUNCE_KEY, false);
  const digits = !shown || analog;
  const speaks = useHasVoice();
  return (
    <div style={{ display: "grid", justifyItems: "start", gap: 8, paddingInlineStart: 40 }}>
      <Checkbox checked={shown} onCheckedChange={setShown}>
        Show date and time in menu bar
      </Checkbox>
      <RadioGroup
        aria-label="Time options"
        value={analog ? "analog" : "digital"}
        onValueChange={(value) => setAnalog(value === "analog")}
        disabled={!shown}
        style={{ display: "flex", gap: 16 }}
      >
        <RadioButton value="digital">Digital</RadioButton>
        <RadioButton value="analog">Analog</RadioButton>
      </RadioGroup>
      <Setting setting={CLOCK_SECONDS_KEY} disabled={digits}>
        Display the time with seconds
      </Setting>
      <Setting setting={CLOCK_FLASH_KEY} disabled={digits}>
        Flash the time separators
      </Setting>
      <Checkbox checked={hour24} onCheckedChange={setHour24} disabled={digits}>
        Use a 24-hour clock
      </Checkbox>
      <Setting setting={CLOCK_AM_PM_KEY} initial disabled={digits || hour24}>
        Show AM/PM
      </Setting>
      <Setting setting={CLOCK_WEEKDAY_KEY} initial disabled={digits}>
        Show the day of the week
      </Setting>
      <Setting setting={CLOCK_DATE_KEY} disabled={digits}>
        Show date
      </Setting>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8 }}
        title={speaks ? undefined : "This browser has no voice to announce the time with."}
      >
        <Checkbox checked={announce} onCheckedChange={setAnnounce} disabled={!speaks}>
          Announce the time:
        </Checkbox>
        <PaneChoice
          setting={CLOCK_ANNOUNCE_EVERY_KEY}
          options={Object.keys(ANNOUNCE_EVERY)}
          initial="On the hour"
          width={150}
          aria-label="How often to announce the time"
          disabled={!speaks || !announce}
        />
      </div>
    </div>
  );
}

/** The difference from UTC of the computer's time zone now, as "UTC+02:00". */
function utcOffset(now: Date): string {
  const minutes = -now.getTimezoneOffset();
  const hours = String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0");
  const rest = String(Math.abs(minutes) % 60).padStart(2, "0");
  return `UTC${minutes < 0 ? "−" : "+"}${hours}:${rest}`;
}

const zoneName = (now: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZoneName: "long" })
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName")?.value ?? "Not reported by this browser";

/**
 * Date & Time on the served desktop, with the three tabs of the real pane: the computer's date and
 * time, which a page reads and cannot set; its time zone, from `Intl`; and the menu bar clock, which
 * is this desktop's own and so can be set.
 */
export function ServedDateAndTime() {
  const now = useNow();
  const [tab, setTab] = usePreference<string>("date-and-time.tab", "date-and-time");
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Not reported by this browser";
  return (
    <>
      <TabView
        value={tab}
        onValueChange={(value) => setTab(value as string)}
        style={{ position: "absolute", left: 20, top: 24, width: 628, height: 432 }}
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
          <ServedPage
            title="Your Computer's Clock"
            statement="This is your computer's date and time, as the browser reads them. A web page cannot set them, set them automatically or choose a time server: change those in your computer's own settings."
            facts={[
              ["Date", now.toLocaleDateString("en-US", { dateStyle: "full" })],
              ["Time", now.toLocaleTimeString("en-US", { timeStyle: "medium" })],
            ]}
            detail={<Today now={now} />}
          >
            <Label textStyle="small" style={{ alignSelf: "center" }}>
              To set date and time formats, use Language & Region preferences.
            </Label>
            <OpenPane id="language-and-region">Open Language & Region…</OpenPane>
          </ServedPage>
        </TabViewPanel>
        <TabViewPanel value="time-zone">
          <ServedPage
            title="Your Computer's Time Zone"
            statement="This is your computer's time zone, as the browser reads it. A web page cannot change it or set it from your location: change it in your computer's own settings."
            facts={[
              ["Time zone", zone],
              ["Name", zoneName(now)],
              ["Difference from UTC", utcOffset(now)],
            ]}
          />
        </TabViewPanel>
        <TabViewPanel value="clock">
          <ServedPage
            title="Menu Bar Clock"
            statement="These set the clock in this desktop's menu bar, which the computer's own clock does not follow."
            detail={<ClockSettings />}
          />
        </TabViewPanel>
      </TabView>
      <PaneFooter x={25.5} y={518.5}>
        <LockButton state="locked" disabled title={NO_ADMINISTRATOR}>
          Nothing here needs an administrator.
        </LockButton>
      </PaneFooter>
    </>
  );
}
