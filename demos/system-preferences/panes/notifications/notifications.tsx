"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Box } from "macalicious/box";
import { Checkbox } from "macalicious/checkbox";
import { DatePicker } from "macalicious/date-picker";
import { EmptyState } from "macalicious/empty-state";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { useId, useState } from "react";
import { AppTile } from "../../../desktop/desktop-artwork";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneChoice } from "../../choice";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { APPS, type AppId, NotificationCenterArtwork, RowArtwork } from "./artwork";
import { NOTIFYING_APPS, ruleKey, ruleOf, ruleSummary } from "./notification-rules";

/** The settings box's top-left corner in the window frame. */
const BOX = { x: 260, y: 110 };

/** The row that is not an application. */
const DO_NOT_DISTURB = "do-not-disturb";

/** The applications of the light capture, in its order. */
const CAPTURED_APPS: readonly AppId[] = [
  "books",
  "calendar",
  "facetime",
  "games",
  "home",
  "mail",
  "messages",
  "music",
];

/**
 * The settings keep a time as minutes since midnight; the date picker works on a `Date`, here
 * on one fixed day, so only its hour and minute count.
 */
const toDate = (minutes: number) => new Date(2001, 0, 1, Math.floor(minutes / 60), minutes % 60);
const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes();
/** The fields are 65 pt wide; with the stepper and the 3.5 pt before it, 81.5 pt. */
const TIME_FIELD = { width: 81.5 };

/** Do Not Disturb's conditions that the served desktop cannot choose: what it does, and why. */
const LOCKED_NOTE =
  "This desktop's lock screen closes its notifications: none come in until it is unlocked.";
const MIRRORING_NOTE = "A web page cannot tell when your computer mirrors its display.";

/** One application's settings, as the pane keeps them. */
function useAppRule(app: string) {
  const allow = usePreference(ruleKey(app, "allow"), true);
  const style = usePreference<string>(ruleKey(app, "style"), "default");
  const center = usePreference(ruleKey(app, "center"), true);
  const sound = usePreference(ruleKey(app, "sound"), true);
  return { allow, style, center, sound };
}

/** A served application's row, whose second line follows its settings. */
function ServedAppRow({ app, name }: { app: string; name: string }) {
  const { allow, style, center, sound } = useAppRule(app);
  const rule = ruleOf(
    {
      [ruleKey(app, "allow")]: allow[0],
      [ruleKey(app, "style")]: style[0],
      [ruleKey(app, "center")]: center[0],
      [ruleKey(app, "sound")]: sound[0],
    },
    app,
  );
  return (
    <BorderedListRow
      value={app}
      title={name}
      subtitle={ruleSummary(rule)}
      leading={
        <span style={{ display: "block", width: 32, height: 32 }}>
          <AppTile id={app} name={name} />
        </span>
      }
      style={{ minHeight: 41 }}
    />
  );
}

/**
 * One application's settings on the served desktop, which its banners and Notification Center
 * follow. A web page's Dock has no badges and its lock screen shows no notifications, so those two
 * Mac settings are not offered.
 */
function ServedAppSettings({
  app,
  name,
  onChange,
}: {
  app: string;
  name: string;
  /** A setting changed: the list's row reads it again. */
  onChange: () => void;
}) {
  const {
    allow: [allow, writeAllow],
    style: [style, writeStyle],
    center: [center, writeCenter],
    sound: [sound, writeSound],
  } = useAppRule(app);
  const changing =
    <T,>(write: (value: T) => void) =>
    (value: T) => {
      write(value);
      onChange();
    };
  const setAllow = changing(writeAllow);
  const setStyle = changing(writeStyle);
  const setCenter = changing(writeCenter);
  const setSound = changing(writeSound);
  const id = useId();
  return (
    <PaneForm origin={BOX}>
      <PaneAt x={280.5} y={128.5}>
        <Checkbox checked={allow} onCheckedChange={setAllow}>
          Allow Notifications from {name}
        </Checkbox>
      </PaneAt>
      <PaneAt x={280.5} y={162}>
        <Label id={`${id}-style`}>{name} alert style:</Label>
      </PaneAt>
      <PaneAt x={292} y={186}>
        <RadioGroup
          aria-labelledby={`${id}-style`}
          value={style}
          onValueChange={(value) => setStyle(value as string)}
          disabled={!allow}
          style={{ gap: 8 }}
        >
          <RadioButton value="default">As {name} sends them</RadioButton>
          <RadioButton value="none">None</RadioButton>
          <RadioButton value="banners">Banners</RadioButton>
          <RadioButton value="alerts">Alerts</RadioButton>
        </RadioGroup>
      </PaneAt>
      <PaneAt x={280.5} y={290}>
        <Checkbox checked={center} onCheckedChange={setCenter} disabled={!allow}>
          Show in Notification Center
        </Checkbox>
      </PaneAt>
      <PaneAt x={280.5} y={314}>
        <Checkbox checked={sound} onCheckedChange={setSound} disabled={!allow}>
          Play sound for notifications
        </Checkbox>
      </PaneAt>
      <PaneAt x={280.5} y={350}>
        <Label textStyle="small" color="secondary">
          Badges and the lock screen are not offered: this desktop&apos;s Dock
          <br />
          shows no badges, and its lock screen shows no notifications.
        </Label>
      </PaneAt>
    </PaneForm>
  );
}

/**
 * System Preferences > Notifications. On the served desktop the list is the applications that really
 * send notifications, and each one's settings are followed. In the library demo the list is the
 * capture's: its settings keep their state and silence nothing, and no capture shows an application's
 * settings, so choosing one says so.
 *
 * Distances are those of reference/spec/apps/system-preferences-notifications.md, in points
 * from the top-left corner of the window frame.
 */
export function Notifications() {
  const [apps] = usePreference<readonly AppId[]>("notifications.apps", CAPTURED_APPS);
  const [selected, setSelected] = usePreference<string>("notifications.selected", DO_NOT_DISTURB);
  const [scheduled, setScheduled] = usePreference("notifications.scheduled", false);
  const [from, setFrom] = usePreference("notifications.from", 22 * 60);
  const [to, setTo] = usePreference("notifications.to", 7 * 60);
  const [sleeping, setSleeping] = usePreference("notifications.whenSleeping", true);
  const [whenLocked, setWhenLocked] = usePreference("notifications.whenLocked", false);
  const [mirroring, setMirroring] = usePreference("notifications.whenMirroring", true);
  const [calls, setCalls] = usePreference("notifications.allowCalls", false);
  const [repeated, setRepeated] = usePreference("notifications.allowRepeatedCalls", false);
  const id = useId();
  const served = servedByDesktopApp();
  const [rulesChanged, setRulesChanged] = useState(0);
  const servedName = NOTIFYING_APPS.find(([app]) => app === selected)?.[1];
  // A row of the library's list that the served list does not hold stands for Do Not Disturb.
  const showsDnd = selected === DO_NOT_DISTURB || (served && !servedName);
  const selectedName = showsDnd
    ? "Do Not Disturb"
    : served
      ? (servedName as string)
      : APPS[selected as AppId];

  return (
    <PaneForm>
      <PaneAt x={20.5} y={58.5}>
        <Label id={`${id}-about`}>
          Notification Center shows your alerts in the upper-right of your screen, without
          interrupting what you’re
          <br />
          doing. Show and hide Notification Center by clicking its icon in the menu bar.
        </Label>
      </PaneAt>

      <PaneAt x={20} y={110}>
        <BorderedList style={{ width: 232, height: 362 }}>
          <BorderedListRows
            aria-label="Applications"
            rowHeight={40}
            value={[selected]}
            onValueChange={(value) => {
              const [next] = value;
              if (next !== undefined) setSelected(next);
            }}
          >
            <BorderedListRow
              value={DO_NOT_DISTURB}
              title="Do Not Disturb"
              leading={<RowArtwork icon={DO_NOT_DISTURB} />}
            />
            {served
              ? NOTIFYING_APPS.map(([app, name]) => (
                  <ServedAppRow key={`${app} ${rulesChanged}`} app={app} name={name} />
                ))
              : apps.map((app) => (
                  <BorderedListRow
                    key={app}
                    value={app}
                    title={APPS[app]}
                    subtitle={`Badges, Sounds, ${app === "calendar" ? "Alerts" : "Banners"}`}
                    leading={<RowArtwork icon={app} />}
                    style={{ minHeight: 41 }}
                  />
                ))}
          </BorderedListRows>
        </BorderedList>
      </PaneAt>

      <PaneAt x={BOX.x} y={BOX.y}>
        <Box aria-label={selectedName} style={{ position: "relative", width: 388, height: 362 }}>
          {showsDnd ? (
            <PaneForm origin={BOX}>
              <PaneAt x={280.5} y={128.5}>
                <Label>
                  Turn on Do Not Disturb in
                  <br />
                  Notification Center
                </Label>
              </PaneAt>
              <PaneAt x={281} y={167.5}>
                <Label textStyle="small" color="secondary">
                  Banners and alerts will be hidden and
                  <br />
                  notification sounds will be silenced.
                </Label>
              </PaneAt>
              <PaneAt x={526.5} y={130}>
                <NotificationCenterArtwork />
              </PaneAt>

              {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring form semantics and a box of its own; this names the rows under the heading. */}
              <div role="group" aria-labelledby={`${id}-turn-on`}>
                <PaneAt x={280.5} y={210.5}>
                  <Label id={`${id}-turn-on`}>Turn on Do Not Disturb:</Label>
                </PaneAt>
                <PaneAt x={292} y={239}>
                  <Checkbox checked={scheduled} onCheckedChange={setScheduled}>
                    From:
                  </Checkbox>
                </PaneAt>
                {/* The two times: the library's date picker, hour and minute, with its
                    stepper. */}
                <PaneAt x={353.5} y={234.5}>
                  <DatePicker
                    aria-label="From"
                    elements="hourMinute"
                    value={toDate(from)}
                    onValueChange={(date) => setFrom(minutesOf(date))}
                    style={TIME_FIELD}
                  />
                </PaneAt>
                <PaneAt x={443} y={238.5}>
                  <Label id={`${id}-to`}>to:</Label>
                </PaneAt>
                <PaneAt x={467.5} y={234.5}>
                  <DatePicker
                    aria-labelledby={`${id}-to`}
                    elements="hourMinute"
                    value={toDate(to)}
                    onValueChange={(date) => setTo(minutesOf(date))}
                    style={TIME_FIELD}
                  />
                </PaneAt>
                <PaneAt x={292} y={263}>
                  <Checkbox checked={sleeping} onCheckedChange={setSleeping}>
                    When the display is sleeping
                  </Checkbox>
                </PaneAt>
                <PaneAt x={292} y={287}>
                  <Checkbox
                    checked={served ? true : whenLocked}
                    disabled={served}
                    title={served ? LOCKED_NOTE : undefined}
                    onCheckedChange={setWhenLocked}
                  >
                    When the screen is locked
                  </Checkbox>
                </PaneAt>
                <PaneAt x={292} y={311}>
                  <Checkbox
                    checked={served ? false : mirroring}
                    disabled={served}
                    title={served ? MIRRORING_NOTE : undefined}
                    onCheckedChange={setMirroring}
                  >
                    When mirroring to TVs and projectors
                  </Checkbox>
                </PaneAt>
              </div>

              {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring form semantics and a box of its own; this names the rows under the heading. */}
              <div role="group" aria-labelledby={`${id}-turned-on`}>
                <PaneAt x={280.5} y={339.5}>
                  <Label id={`${id}-turned-on`}>When Do Not Disturb is turned on:</Label>
                </PaneAt>
                <PaneAt x={292} y={363}>
                  <Checkbox checked={calls} onCheckedChange={setCalls}>
                    Allow calls from everyone
                  </Checkbox>
                </PaneAt>
                <PaneAt x={292} y={387}>
                  <Checkbox
                    checked={repeated}
                    onCheckedChange={setRepeated}
                    aria-describedby={`${id}-repeated-note`}
                  >
                    Allow repeated calls
                  </Checkbox>
                </PaneAt>
                <PaneAt x={312.5} y={408.5}>
                  <Label id={`${id}-repeated-note`} textStyle="small" color="secondary">
                    When enabled, a second call from the same person within
                    <br />
                    three minutes will not be silenced.
                  </Label>
                </PaneAt>
              </div>
            </PaneForm>
          ) : served ? (
            <ServedAppSettings
              key={selected}
              app={selected}
              name={selectedName}
              onChange={() => setRulesChanged((count) => count + 1)}
            />
          ) : (
            <EmptyState>
              The settings of {APPS[selected as AppId]} are not part of this demo.
            </EmptyState>
          )}
        </Box>
      </PaneAt>

      <PaneAt x={21} y={492.5}>
        <Label id={`${id}-sort-order`}>Notification Center sort order:</Label>
      </PaneAt>
      <PaneAt x={210} y={490}>
        <PaneChoice
          setting="notifications.sortOrder"
          options={["Recents", "Recents by App", "Manually by App"]}
          initial={served ? "Recents by App" : "Recents"}
          width={133.5}
          aria-labelledby={`${id}-sort-order`}
        />
      </PaneAt>

      <PaneFooter right={20} y={491}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}
