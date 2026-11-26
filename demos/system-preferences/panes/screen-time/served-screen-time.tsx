"use client";

import { Checkbox } from "macalicious/checkbox";
import { DatePicker } from "macalicious/date-picker";
import { DefaultButton } from "macalicious/default-button";
import { GradientButton } from "macalicious/gradient-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { SheetActions } from "macalicious/sheet";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { TextField } from "macalicious/text-field";
import { type ReactNode, useEffect, useState } from "react";
import { ACCOUNT_PICTURE_KEY, readAccountPicture } from "../../../desktop/desktop-account-picture";
import { useDesktopSetting } from "../../../desktop/desktop-personal";
import {
  dayOf,
  SCREEN_TIME_ON_KEY,
  type ScreenTimeUsage,
  useNotificationCounts,
  useScreenTimeUsage,
} from "../../../desktop/desktop-screen-time";
import { usePreference } from "../../pane";
import { PaneSheet } from "../../pane-sheet";
import { type Fact, ServedPage, useAppNames, useServedAccount } from "../../served-pages";
import { ScreenTimeFrame } from "./screen-time";
import {
  ALWAYS_ALLOWED_KEY,
  APP_LIMITS_KEY,
  type AppLimit,
  CONTENT_PRIVACY_KEY,
  DAY_NAMES,
  DOWNTIME_KEY,
  type DowntimeMoment,
  downtimeAt,
  readAlwaysAllowed,
  readAppLimits,
  readContentPrivacy,
  readDowntime,
  secondsUsed,
  type WebContent,
} from "./screen-time-rules";

/** A time as Screen Time writes it. */
const usedText = (seconds: number) =>
  seconds < 60
    ? "Less than a minute"
    : seconds < 3600
      ? `${Math.round(seconds / 60)} min`
      : `${Math.floor(seconds / 3600)} hr ${Math.round((seconds % 3600) / 60)} min`;

/** Seven days as bars: pressing one, or an arrow, chooses that day. */
function UsageChart({
  days,
  totals,
  chosen,
  least,
  say,
  onChoose,
}: {
  days: readonly Date[];
  totals: readonly number[];
  chosen: number;
  /** The total that fills a bar when no day has more. */
  least: number;
  say: (total: number) => string;
  onChoose: (day: number) => void;
}) {
  const most = Math.max(...totals, least);
  const name = (day: Date) => day.toLocaleDateString("en-US", { weekday: "short" });
  return (
    <div className="mac-system-preferences-served-chart">
      <PushButton
        size="small"
        aria-label="Earlier day"
        disabled={chosen === 0}
        onClick={() => onChoose(chosen - 1)}
      >
        ‹
      </PushButton>
      {/* biome-ignore lint/a11y/useSemanticElements: a group of buttons has no element of its own */}
      <div role="group" aria-label="The last seven days">
        {days.map((day, index) => (
          <button
            key={dayOf(day)}
            type="button"
            aria-pressed={index === chosen}
            aria-label={`${name(day)}: ${say(totals[index] ?? 0)}`}
            onClick={() => onChoose(index)}
          >
            <span style={{ height: `${Math.round(((totals[index] ?? 0) / most) * 100)}%` }} />
            <Label textStyle="small">{name(day)}</Label>
          </button>
        ))}
      </div>
      <PushButton
        size="small"
        aria-label="Later day"
        disabled={chosen === days.length - 1}
        onClick={() => onChoose(chosen + 1)}
      >
        ›
      </PushButton>
    </div>
  );
}

/** How many notifications, as Screen Time writes it. */
const countText = (count: number) => `${count} ${count === 1 ? "notification" : "notifications"}`;

const FIGURES = {
  "app-usage": {
    statement:
      "This counts how long each app has been in front on this desktop, while the page is showing, the browser's window is in front and you have used it in the last two minutes. A web page cannot see your other apps or set limits on them. Apps here have no categories, so they are listed by name.",
    say: usedText,
    least: 60,
  },
  notifications: {
    statement:
      "This counts the notifications this desktop delivered to you, from the first time a page of it saw each one. A web page cannot see the notifications of your other apps, or how often you pick up a device.",
    say: countText,
    least: 1,
  },
} as const;

/** App Usage and Notifications: seven days of what this desktop counted. */
function Figures({ section }: { section: keyof typeof FIGURES }) {
  const usage = useScreenTimeUsage();
  const counts = useNotificationCounts();
  const { statement, say, least } = FIGURES[section];
  const figures: ScreenTimeUsage = section === "app-usage" ? usage : counts.days;
  const names = useAppNames();
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const timer = setTimeout(() => setToday(new Date()), tomorrow.getTime() - today.getTime());
    return () => clearTimeout(timer);
  }, [today]);
  const days = Array.from(
    { length: 7 },
    (_, back) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + back),
  );
  const [chosenName, setChosenName] = useState<string | null>(null);
  const chosenIndex = days.findIndex((day) => dayOf(day) === chosenName);
  const chosen = chosenIndex === -1 ? days.length - 1 : chosenIndex;
  const choose = (day: number) => setChosenName(dayOf(days[day] ?? today));
  const totals = days.map((day) =>
    Object.values(figures[dayOf(day)] ?? {}).reduce((sum, seconds) => sum + seconds, 0),
  );
  const chosenDay = days[chosen] ?? today;
  const apps = Object.entries(figures[dayOf(chosenDay)] ?? {}).sort(([, a], [, b]) => b - a);
  const week = totals.reduce((sum, seconds) => sum + seconds, 0);
  return (
    <ServedPage
      title="Screen Time"
      statement={statement}
      facts={[
        [
          chosen === days.length - 1
            ? "Today"
            : chosenDay.toLocaleDateString("en-US", { weekday: "long" }),
          apps.length > 0 ? say(totals[chosen] ?? 0) : "Nothing yet",
        ],
        ["The last seven days", week > 0 ? say(week) : "Nothing yet"],
        ...apps.map(([app, figure]): Fact => [names.get(app) ?? app, say(figure)]),
      ]}
      detail={
        <UsageChart
          days={days}
          totals={totals}
          chosen={chosen}
          least={least}
          say={say}
          onChoose={choose}
        />
      }
    />
  );
}

/** A section's state, and the button that turns it on and off. */
function TurnOn({
  name,
  on,
  onChange,
}: {
  name: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="mac-system-preferences-screen-time-switch">
      <Label textStyle="emphasized">
        {name}: {on ? "On" : "Off"}
      </Label>
      <PushButton onClick={() => onChange(!on)}>{on ? "Turn Off" : "Turn On"}</PushButton>
    </div>
  );
}

const clockText = (time: Date) =>
  time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** What a schedule means now, in words. */
function momentText(moment: DowntimeMoment, now: Date) {
  if (moment.active) return `In downtime until ${clockText(moment.until)}`;
  if (moment.next === null) return "No downtime is scheduled";
  const day =
    dayOf(moment.next) === dayOf(now)
      ? "today"
      : moment.next.toLocaleDateString("en-US", { weekday: "long" });
  return `Starts ${day} at ${clockText(moment.next)}`;
}

/** The clock, read again each half minute. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

function TimeField({
  label,
  time,
  disabled,
  onChange,
}: {
  label: string;
  time: string;
  disabled: boolean;
  onChange: (time: string) => void;
}) {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return (
    <DatePicker
      aria-label={label}
      elements="hourMinute"
      value={new Date(2001, 0, 1, hours, minutes)}
      disabled={disabled}
      onValueChange={(value) =>
        onChange(`${twoDigits(value.getHours())}:${twoDigits(value.getMinutes())}`)
      }
    />
  );
}

const KEPT_NOT_ENFORCED =
  "This desktop keeps this for your account, but it does not close or block an application because of it.";

function DowntimeSection() {
  const [stored, save] = usePreference<unknown>(DOWNTIME_KEY, null);
  const downtime = readDowntime(stored);
  const now = useNow();
  const off = !downtime.on;
  const reason = off ? "Turn Downtime on to change its schedule." : undefined;
  return (
    <ServedPage
      title="Downtime"
      statement={`A time away from the screen, when only the applications in Always Allowed would be available. ${KEPT_NOT_ENFORCED}`}
      facts={off ? [] : [["Now", momentText(downtimeAt(downtime, now), now)]]}
      detail={
        <>
          <TurnOn name="Downtime" on={downtime.on} onChange={(on) => save({ ...downtime, on })} />
          <div className="mac-system-preferences-screen-time-settings" title={reason}>
            <RadioGroup
              aria-label="Schedule"
              disabled={off}
              value={downtime.custom ? "custom" : "every-day"}
              onValueChange={(value) => save({ ...downtime, custom: value === "custom" })}
            >
              <RadioButton value="every-day">Every Day</RadioButton>
              <RadioButton value="custom">Custom</RadioButton>
            </RadioGroup>
            {downtime.custom ? (
              DAY_NAMES.map((name, index) => {
                const day = downtime.days[index] ?? { on: true, from: "22:00", to: "07:00" };
                const change = (next: Partial<typeof day>) =>
                  save({
                    ...downtime,
                    days: downtime.days.map((each, at) =>
                      at === index ? { ...each, ...next } : each,
                    ),
                  });
                return (
                  <div key={name} className="mac-system-preferences-screen-time-row">
                    <Checkbox
                      checked={day.on}
                      disabled={off}
                      onCheckedChange={(on) => change({ on })}
                    >
                      {name}
                    </Checkbox>
                    <TimeField
                      label={`${name} from`}
                      time={day.from}
                      disabled={off || !day.on}
                      onChange={(from) => change({ from })}
                    />
                    <Label>to</Label>
                    <TimeField
                      label={`${name} to`}
                      time={day.to}
                      disabled={off || !day.on}
                      onChange={(to) => change({ to })}
                    />
                  </div>
                );
              })
            ) : (
              <div className="mac-system-preferences-screen-time-row">
                <Label>From</Label>
                <TimeField
                  label="From"
                  time={downtime.from}
                  disabled={off}
                  onChange={(from) => save({ ...downtime, from })}
                />
                <Label>to</Label>
                <TimeField
                  label="To"
                  time={downtime.to}
                  disabled={off}
                  onChange={(to) => save({ ...downtime, to })}
                />
              </div>
            )}
          </div>
        </>
      }
    />
  );
}

/** The sheet that adds a limit, or changes one. */
function LimitSheet({
  frame,
  limit,
  apps,
  onDone,
  onClose,
}: {
  frame: Element;
  limit: AppLimit | null;
  apps: readonly (readonly [id: string, name: string])[];
  onDone: (limit: AppLimit) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<readonly string[]>(limit?.apps ?? []);
  const [typed, setTyped] = useState(String(limit?.minutes ?? 30));
  const minutes = Number(typed);
  const valid = chosen.length > 0 && Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440;
  return (
    <PaneSheet frame={frame} title={limit ? "Edit Limit" : "Add Limit"} onClose={onClose}>
      <div className="mac-system-preferences-screen-time-panel">
        <ul aria-label="Applications" className="mac-system-preferences-screen-time-apps">
          {apps.map(([id, name]) => (
            <li key={id}>
              <Checkbox
                checked={chosen.includes(id)}
                onCheckedChange={(on) =>
                  setChosen(on ? [...chosen, id] : chosen.filter((app) => app !== id))
                }
              >
                {name}
              </Checkbox>
            </li>
          ))}
        </ul>
        <div className="mac-system-preferences-screen-time-row">
          <Label>Time:</Label>
          <TextField
            aria-label="Minutes a day"
            inputMode="numeric"
            value={typed}
            onChange={(event) => setTyped(event.currentTarget.value)}
            style={{ width: 60 }}
          />
          <Label>minutes a day</Label>
        </div>
      </div>
      <SheetActions>
        <PushButton onClick={onClose}>Cancel</PushButton>
        <DefaultButton
          disabled={!valid}
          onClick={() =>
            onDone({
              id: limit?.id ?? `limit-${Date.now().toString(36)}`,
              apps: chosen,
              minutes,
              on: limit?.on ?? true,
            })
          }
        >
          Done
        </DefaultButton>
      </SheetActions>
    </PaneSheet>
  );
}

/** The applications a person can limit or allow: Finder and this window stay out of it. */
const choosable = (names: ReadonlyMap<string, string>) =>
  [...names].filter(([id]) => id !== "finder" && id !== "system-preferences");

function AppLimitsSection() {
  const [stored, save] = usePreference<unknown>(APP_LIMITS_KEY, null);
  const settings = readAppLimits(stored);
  const usage = useScreenTimeUsage();
  const now = useNow();
  const names = useAppNames();
  const [editing, setEditing] = useState<{ frame: Element; limit: AppLimit | null } | null>(null);
  const openSheet = (target: Element, limit: AppLimit | null) =>
    setEditing({ frame: target.closest(".mac-window") ?? document.body, limit });
  const today = usage[dayOf(now)];
  const off = !settings.on;
  const reason = off ? "Turn App Limits on to change them." : undefined;
  return (
    <ServedPage
      title="App Limits"
      statement={`A daily time for an application, measured by App Usage. ${KEPT_NOT_ENFORCED}`}
      detail={
        <>
          <TurnOn name="App Limits" on={settings.on} onChange={(on) => save({ ...settings, on })} />
          <div className="mac-system-preferences-screen-time-settings" title={reason}>
            {settings.limits.length > 0 ? (
              <ul aria-label="Limits" className="mac-system-preferences-screen-time-limits">
                {settings.limits.map((limit) => {
                  const named = limit.apps.map((app) => names.get(app) ?? app).join(", ");
                  const used = secondsUsed(limit, today);
                  const allowed = limit.minutes * 60;
                  return (
                    <li key={limit.id}>
                      <Checkbox
                        checked={limit.on}
                        disabled={off}
                        onCheckedChange={(on) =>
                          save({
                            ...settings,
                            limits: settings.limits.map((each) =>
                              each.id === limit.id ? { ...each, on } : each,
                            ),
                          })
                        }
                      >
                        {named}
                      </Checkbox>
                      <Label color="secondary">
                        {used >= allowed
                          ? `${usedText(allowed)} used today: limit reached`
                          : `${usedText(used)} of ${usedText(allowed)} today`}
                      </Label>
                      <PushButton
                        size="small"
                        disabled={off}
                        aria-label={`Edit limit for ${named}`}
                        onClick={(event) => openSheet(event.currentTarget, limit)}
                      >
                        Edit…
                      </PushButton>
                      <GradientButton
                        glyph="remove"
                        disabled={off}
                        aria-label={`Remove limit for ${named}`}
                        onClick={() =>
                          save({
                            ...settings,
                            limits: settings.limits.filter((each) => each.id !== limit.id),
                          })
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Label color="secondary">No limits</Label>
            )}
            <GradientButton
              glyph="add"
              disabled={off}
              aria-label="Add a limit"
              onClick={(event) => openSheet(event.currentTarget, null)}
            />
            <Checkbox
              checked={settings.block}
              disabled={off}
              onCheckedChange={(block) => save({ ...settings, block })}
            >
              Block at end of limit
            </Checkbox>
          </div>
          {editing ? (
            <LimitSheet
              frame={editing.frame}
              limit={editing.limit}
              apps={choosable(names)}
              onClose={() => setEditing(null)}
              onDone={(limit) => {
                const known = settings.limits.some((each) => each.id === limit.id);
                save({
                  ...settings,
                  limits: known
                    ? settings.limits.map((each) => (each.id === limit.id ? limit : each))
                    : [...settings.limits, limit],
                });
                setEditing(null);
              }}
            />
          ) : null}
        </>
      }
    />
  );
}

function AlwaysAllowedSection() {
  const [stored, save] = usePreference<unknown>(ALWAYS_ALLOWED_KEY, null);
  const allowed = readAlwaysAllowed(stored);
  const names = useAppNames();
  return (
    <ServedPage
      title="Always Allowed"
      statement={`The applications that would stay available during downtime and past a limit. Finder and System Preferences always do. ${KEPT_NOT_ENFORCED}`}
      detail={
        <ul aria-label="Allowed applications" className="mac-system-preferences-screen-time-apps">
          {choosable(names).map(([id, name]) => (
            <li key={id}>
              <Checkbox
                checked={allowed.includes(id)}
                onCheckedChange={(on) =>
                  save(on ? [...allowed, id] : allowed.filter((app) => app !== id))
                }
              >
                {name}
              </Checkbox>
            </li>
          ))}
        </ul>
      }
    />
  );
}

/** What Content & Privacy allows, by tab: everything until it is unchecked. */
const CONTENT_TABS = [
  [
    "Content",
    [
      "Explicit language in Siri & Dictionary",
      "Multiplayer games in Game Center",
      "Adding friends in Game Center",
    ],
  ],
  [
    "Stores",
    ["Explicit music, podcasts and news", "Explicit books", "Music videos", "Installing apps"],
  ],
  ["Apps", ["Camera", "FaceTime", "Siri", "Safari"]],
  ["Other", ["Changes to passcode", "Changes to accounts"]],
] as const;

const WEB_CONTENT: readonly (readonly [WebContent, string])[] = [
  ["unrestricted", "Unrestricted Access"],
  ["limit-adult", "Limit Adult Websites"],
  ["allowed-only", "Allowed Websites Only"],
];

function ContentPrivacySection() {
  const [stored, save] = usePreference<unknown>(CONTENT_PRIVACY_KEY, null);
  const settings = readContentPrivacy(stored);
  const [tab, setTab] = useState<string>("Content");
  const off = !settings.on;
  const reason = off ? "Turn Content & Privacy on to change it." : undefined;
  return (
    <ServedPage
      title="Content & Privacy"
      statement={`What this account's applications would allow. ${KEPT_NOT_ENFORCED} Safari and the stores here do not filter what they show.`}
      detail={
        <>
          <TurnOn
            name="Content & Privacy"
            on={settings.on}
            onChange={(on) => save({ ...settings, on })}
          />
          <div className="mac-system-preferences-screen-time-settings" title={reason}>
            <TabView value={tab} onValueChange={(value) => setTab(value as string)}>
              <TabViewList aria-label="Content & Privacy">
                {CONTENT_TABS.map(([name]) => (
                  <TabViewTab key={name} value={name}>
                    {name}
                  </TabViewTab>
                ))}
              </TabViewList>
              {CONTENT_TABS.map(([name, allows]) => (
                <TabViewPanel key={name} value={name}>
                  <div className="mac-system-preferences-screen-time-settings">
                    {name === "Content" ? (
                      <RadioGroup
                        aria-label="Web Content"
                        disabled={off}
                        value={settings.web}
                        onValueChange={(web) => save({ ...settings, web })}
                      >
                        {WEB_CONTENT.map(([value, title]) => (
                          <RadioButton key={value} value={value}>
                            {title}
                          </RadioButton>
                        ))}
                      </RadioGroup>
                    ) : null}
                    <Label>Allow:</Label>
                    {allows.map((allow) => (
                      <Checkbox
                        key={allow}
                        checked={!settings.denied.includes(allow)}
                        disabled={off}
                        onCheckedChange={(on) =>
                          save({
                            ...settings,
                            denied: on
                              ? settings.denied.filter((each) => each !== allow)
                              : [...settings.denied, allow],
                          })
                        }
                      >
                        {allow}
                      </Checkbox>
                    ))}
                  </div>
                </TabViewPanel>
              ))}
            </TabView>
          </div>
        </>
      }
    />
  );
}

function OptionsSection() {
  const [counting, setCounting] = usePreference(SCREEN_TIME_ON_KEY, true);
  return (
    <ServedPage
      title="Options"
      statement="Off, nothing is counted, and what was counted stays."
      detail={
        <div className="mac-system-preferences-screen-time-settings">
          <Checkbox checked={counting} onCheckedChange={setCounting}>
            Count Screen Time on this desktop
          </Checkbox>
          <Checkbox
            disabled
            title="Sharing across devices needs an Apple ID, and this desktop has none."
          >
            Share across devices
          </Checkbox>
          <Checkbox
            disabled
            title="A passcode needs a parent's account over a child's, and accounts here are all alike."
          >
            Use Screen Time Passcode
          </Checkbox>
        </div>
      }
    />
  );
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

/**
 * Screen Time on the served desktop, in the pane's frame: the eight sections of the list, each with
 * what this desktop really counts or keeps, and saying what it does not do.
 */
export function ServedScreenTime() {
  const [section, setSection] = useState<string>("app-usage");
  const account = useServedAccount();
  const [picture] = useDesktopSetting<string | undefined>(
    ACCOUNT_PICTURE_KEY,
    readAccountPicture,
    undefined,
  );
  const name = account?.fullName ?? "";
  const shown: Record<string, ReactNode> = {
    pickups: (
      <ServedPage
        title="Pickups"
        statement="A web page cannot see how often you pick up a device, so nothing is counted here."
      />
    ),
    downtime: <DowntimeSection />,
    "app-limits": <AppLimitsSection />,
    "always-allowed": <AlwaysAllowedSection />,
    "content-and-privacy": <ContentPrivacySection />,
    options: <OptionsSection />,
  };
  return (
    <ScreenTimeFrame
      name={name}
      picture={picture ? <img src={picture} alt="" width={98} height={98} /> : initialsOf(name)}
      section={section}
      onSectionChange={setSection}
    >
      <div className="mac-system-preferences-screen-time-served">
        {section === "app-usage" || section === "notifications" ? (
          <Figures section={section} />
        ) : (
          shown[section]
        )}
      </div>
    </ScreenTimeFrame>
  );
}
