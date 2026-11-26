"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { GradientButton } from "macalicious/gradient-button";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { useId } from "react";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { localStamp } from "../../../keychain-access/keychain-access-vault";
import { PaneAt, PaneFooter, PaneForm, PaneRow } from "../../form";
import { usePreference, usePreferences } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { FlagArtwork } from "./artwork";
import { formatExamples, REGIONS, servedRegion } from "./formats";

/** The tab view's top-left corner in the window frame: the strip is centred on the box's edge. */
const TABS = { x: 20, y: 107 };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CALENDARS = ["Gregorian", "Buddhist", "Chinese", "Hebrew", "Islamic", "Japanese"];

const TEMPERATURES = [
  ["celsius", "°C — Celsius"],
  ["fahrenheit", "°F — Fahrenheit"],
] as const;

/** The width of the four pop-up buttons: a 204 pt bezel in a box one hairline larger. */
const POP_UP = { width: 205 };

/** Why a served desktop's language list cannot change. */
const BROWSER_LANGUAGES_NOTE =
  "These are your browser's languages, in its order: a web page cannot add, remove or reorder them. Change them in its settings.";

/** What the served desktop does with the settings that have no effect of their own there. */
const REGION_NOTE =
  "Writes the examples below and the date in Notification Center's Today. Other apps keep their own way of writing dates.";
const CALENDAR_NOTE =
  "Writes the examples below and the date in Notification Center's Today. The Calendar app stays Gregorian.";
const ADVANCED_NOTE =
  "This desktop writes dates, numbers and money by the Region chosen here, and has no custom formats to set.";

/** The short name of the browser's time zone, as the examples write it. */
const browserTimeZone = () =>
  new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value ?? "";

/** The languages the browser asks for, first the primary one, by their names in that language. */
export function browserLanguages(
  tags: readonly string[] = navigator.languages,
): readonly { tag: string; name: string }[] {
  const known = tags.length > 0 ? tags : ["en-US"];
  return known.map((tag) => {
    let name = tag;
    try {
      name = new Intl.DisplayNames([tag], { type: "language" }).of(tag) ?? tag;
    } catch {
      // A tag the browser cannot name is shown as it is.
    }
    return { tag, name };
  });
}

/**
 * System Preferences > Language & Region: the General tab. The formatting examples at the foot
 * follow the region and the time format. On the served desktop the list is the browser's languages,
 * the menu bar's clock follows the time format, Calendar the first day of the week, and the examples
 * the calendar too. What a page has nothing to do with is dimmed and says why.
 *
 * Distances are those of reference/spec/apps/system-preferences-language-and-region.md, in
 * points from the top-left corner of the window frame.
 */
export function LanguageAndRegion() {
  const { showPane } = usePreferences();
  const served = servedByDesktopApp();
  const [tab, setTab] = usePreference<string>("language-and-region.tab", "general");
  const [selected, setSelected] = usePreference<readonly string[]>(
    "language-and-region.selectedLanguages",
    [],
  );
  const [regionId, setRegionId] = usePreference<string>(
    "language-and-region.region",
    served ? servedRegion(undefined).id : "united-states",
  );
  const [firstDay, setFirstDay] = usePreference<string>(
    "language-and-region.firstDayOfWeek",
    "Sunday",
  );
  const [calendar, setCalendar] = usePreference<string>(
    "language-and-region.calendar",
    "Gregorian",
  );
  const [twentyFourHour, setTwentyFourHour] = usePreference(
    "language-and-region.twentyFourHourTime",
    false,
  );
  const [temperature, setTemperature] = usePreference<string>(
    "language-and-region.temperature",
    "fahrenheit",
  );
  /** The local time the examples show; the Aqua capture was taken at this one. */
  const [exampleTime] = usePreference("language-and-region.exampleTime", "2019-10-03T10:43:31");
  const id = useId();

  const region = REGIONS.find((item) => item.id === regionId) ?? REGIONS[0];
  const examples = region
    ? served
      ? formatExamples(localStamp(new Date()), region, twentyFourHour, browserTimeZone(), calendar)
      : formatExamples(exampleTime, region, twentyFourHour)
    : undefined;

  return (
    <>
      <PaneForm>
        <PaneAt x={23.5} y={57.5}>
          <FlagArtwork />
        </PaneAt>
        <PaneAt x={88} y={58.5}>
          <Label style={{ whiteSpace: "nowrap" }}>
            Language & Region preferences control the language you see in menus and dialogs, and the
            <br />
            formats of dates, times, and currencies.
          </Label>
        </PaneAt>
      </PaneForm>

      <TabView
        value={tab}
        onValueChange={(value) => setTab(value as string)}
        style={{ position: "absolute", left: TABS.x, top: TABS.y - 38, width: 628, height: 357 }}
      >
        <TabViewList aria-label="Language & Region">
          <TabViewTab value="general" style={{ width: 72, padding: 0 }}>
            General
          </TabViewTab>
          <TabViewTab value="apps" style={{ width: 56, padding: 0 }}>
            Apps
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="general">
          <PaneForm origin={TABS} labelWidth={383} gap={12.5}>
            <PaneAt x={41} y={134.5}>
              <Label id={`${id}-languages`}>Preferred languages:</Label>
            </PaneAt>
            <PaneAt x={40} y={158}>
              <BorderedList
                style={{ width: 200, height: 271 }}
                title={served ? BROWSER_LANGUAGES_NOTE : undefined}
                footerLabel="Edit languages"
                footer={
                  served ? (
                    <>
                      <GradientButton
                        glyph="add"
                        aria-label="Add a language"
                        disabled
                        title={BROWSER_LANGUAGES_NOTE}
                        style={{ width: 25 }}
                      />
                      <GradientButton
                        glyph="remove"
                        aria-label="Remove the selected language"
                        disabled
                        title={BROWSER_LANGUAGES_NOTE}
                        style={{ width: 24 }}
                      />
                    </>
                  ) : (
                    <>
                      <Uncaptured action="Add a language">
                        <GradientButton
                          glyph="add"
                          aria-label="Add a language"
                          style={{ width: 25 }}
                        />
                      </Uncaptured>
                      {/* The only language is the primary one and cannot be removed. */}
                      <GradientButton
                        glyph="remove"
                        aria-label="Remove the selected language"
                        disabled
                        style={{ width: 24 }}
                      />
                    </>
                  )
                }
              >
                <BorderedListRows
                  aria-labelledby={`${id}-languages`}
                  rowHeight={38}
                  value={selected}
                  onValueChange={setSelected}
                >
                  {served ? (
                    browserLanguages().map(({ tag, name }, index) => (
                      <BorderedListRow
                        key={tag}
                        value={tag}
                        title={name}
                        subtitle={index === 0 ? `${name} — Primary` : name}
                      />
                    ))
                  ) : (
                    <BorderedListRow
                      value="english"
                      title="English"
                      subtitle="English (US) — Primary"
                    />
                  )}
                </BorderedListRows>
              </BorderedList>
            </PaneAt>
            {served ? (
              <PaneAt x={41} y={431} width={198}>
                <Label textStyle="small" color="secondary">
                  From your browser, in its order. Change them in its settings.
                </Label>
              </PaneAt>
            ) : null}

            <PaneRow y={162} label="Region:" labelId={`${id}-region`} labelOffset={2}>
              <PopUpButton
                aria-labelledby={`${id}-region`}
                value={regionId}
                onValueChange={(value) => value && setRegionId(value)}
                title={served ? REGION_NOTE : undefined}
                style={POP_UP}
              >
                {REGIONS.map((item) => (
                  <PopUpButtonItem key={item.id} value={item.id}>
                    {item.name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </PaneRow>
            <PaneRow y={193} label="First day of week:" labelId={`${id}-first-day`} labelOffset={2}>
              <PopUpButton
                aria-labelledby={`${id}-first-day`}
                value={firstDay}
                onValueChange={(value) => value && setFirstDay(value)}
                style={POP_UP}
              >
                {WEEKDAYS.map((day) => (
                  <PopUpButtonItem key={day} value={day}>
                    {day}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </PaneRow>
            <PaneRow y={224} label="Calendar:" labelId={`${id}-calendar`} labelOffset={2.5}>
              <PopUpButton
                aria-labelledby={`${id}-calendar`}
                value={calendar}
                onValueChange={(value) => value && setCalendar(value)}
                title={served ? CALENDAR_NOTE : undefined}
                style={POP_UP}
              >
                {CALENDARS.map((name) => (
                  <PopUpButtonItem key={name} value={name}>
                    {name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </PaneRow>
            <PaneRow y={258.5} label="Time format:" labelOffset={-1}>
              <Checkbox checked={twentyFourHour} onCheckedChange={setTwentyFourHour}>
                24-Hour Time
              </Checkbox>
            </PaneRow>
            <PaneRow y={286} label="Temperature:" labelId={`${id}-temperature`} labelOffset={2.5}>
              <PopUpButton
                aria-labelledby={`${id}-temperature`}
                value={temperature}
                onValueChange={(value) => value && setTemperature(value)}
                style={POP_UP}
              >
                {TEMPERATURES.map(([value, title]) => (
                  <PopUpButtonItem key={value} value={value}>
                    {title}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </PaneRow>

            {/* The examples are two centred lines under the settings, on x 441. */}
            {examples ? (
              <>
                <PaneAt x={241} y={382} width={400} style={{ justifyContent: "center" }}>
                  <Label textStyle="small" color="secondary">
                    {examples.full}
                  </Label>
                </PaneAt>
                <PaneAt x={241} y={396} width={400} style={{ justifyContent: "center", gap: 18 }}>
                  <Label textStyle="small" color="secondary">
                    {examples.short}
                  </Label>
                  <Label textStyle="small" color="secondary">
                    {examples.number}
                  </Label>
                  <Label textStyle="small" color="secondary">
                    {examples.currency}
                  </Label>
                </PaneAt>
              </>
            ) : null}
          </PaneForm>
        </TabViewPanel>
        <TabViewPanel value="apps">
          <EmptyState>
            {served
              ? "This desktop is written in English, and no app has a language of its own to choose. Your browser's language sets what Siri listens for and the units in Maps and Find My."
              : "The Apps tab is not part of this demo."}
          </EmptyState>
        </TabViewPanel>
      </TabView>

      <PaneForm>
        <PaneAt x={331} y={476}>
          <PushButton onClick={() => showPane("keyboard")} style={{ width: 173, paddingInline: 0 }}>
            Keyboard Preferences…
          </PushButton>
        </PaneAt>
        <PaneAt x={516} y={476}>
          {served ? (
            <PushButton disabled title={ADVANCED_NOTE} style={{ width: 99, paddingInline: 0 }}>
              Advanced…
            </PushButton>
          ) : (
            <Uncaptured action="Advanced…">
              <PushButton style={{ width: 99, paddingInline: 0 }}>Advanced…</PushButton>
            </Uncaptured>
          )}
        </PaneAt>
        <PaneFooter x={627} y={476}>
          <Uncaptured action="Help">
            <HelpButton />
          </Uncaptured>
        </PaneFooter>
      </PaneForm>
    </>
  );
}
