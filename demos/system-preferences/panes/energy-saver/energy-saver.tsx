"use client";

import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { Slider } from "macalicious/slider";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { useId } from "react";
import { PaneAt, PaneFooter, PaneForm, PaneRow } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";

/**
 * The tab view's top-left corner in the window frame: the strip is centred on the box's top
 * edge, which is at y 128.
 */
const TABS = { x: 20, y: 118 };

/** The slider has sixteen marks; its value is the mark the thumb is on, from 0. */
const MARKS = 16;

/**
 * The marks the legend names: mark, legend, and the same in words. The captures name no other
 * mark, so the delays between them are not known.
 */
const LEGEND = [
  [0, "1 min", "1 minute"],
  [4, "15 min", "15 minutes"],
  [9, "1 hr", "1 hour"],
  [14, "3 hrs", "3 hours"],
  [15, "Never", "Never"],
] as const;

/** Where the first and the last mark are, in the window frame. */
const FIRST_MARK = 183.5;
const LAST_MARK = 602.5;

/** The delay a mark stands for, in words: the legend's, or the two legends it lies between. */
function delayInWords(mark: number) {
  let before: string = LEGEND[0][2];
  for (const [at, , words] of LEGEND) {
    if (at === mark) return words;
    if (at > mark) return `Between ${before} and ${words}`;
    before = words;
  }
  return before;
}

/** The settings of the Power Adapter tab as the captures have them, which are the defaults. */
const DEFAULTS = {
  displaySleep: 3,
  preventSleep: false,
  diskSleep: true,
  wakeForNetwork: true,
  powerNap: true,
};

/**
 * System Preferences > Energy Saver: the Power Adapter tab. The settings keep their state and
 * save no energy. The slider stops at its sixteen marks; the captures name five of them, so
 * the others are announced as lying between two of those. Restore Defaults is disabled while
 * the tab's settings are the captured ones, and puts them back once one has changed. Schedule
 * and the Battery tab say that they are not part of the demo, as no capture shows
 * either.
 *
 * The setting `energy-saver.batteryStatus` holds the line about the battery, which differs
 * between the two captures.
 *
 * Distances are those of reference/spec/apps/system-preferences-energy-saver.md, in points
 * from the top-left corner of the window frame.
 */
export function EnergySaver() {
  const [tab, setTab] = usePreference<string>("energy-saver.tab", "power-adapter");
  const [graphics, setGraphics] = usePreference("energy-saver.automaticGraphicsSwitching", true);
  const [displaySleep, setDisplaySleep] = usePreference(
    "energy-saver.displaySleep",
    DEFAULTS.displaySleep,
  );
  const [preventSleep, setPreventSleep] = usePreference(
    "energy-saver.preventSleep",
    DEFAULTS.preventSleep,
  );
  const [diskSleep, setDiskSleep] = usePreference("energy-saver.diskSleep", DEFAULTS.diskSleep);
  const [wakeForNetwork, setWakeForNetwork] = usePreference(
    "energy-saver.wakeForNetwork",
    DEFAULTS.wakeForNetwork,
  );
  const [powerNap, setPowerNap] = usePreference("energy-saver.powerNap", DEFAULTS.powerNap);
  const [batteryStatus] = usePreference("energy-saver.batteryStatus", "Battery is charged.");
  const [menuBar, setMenuBar] = usePreference("energy-saver.showBatteryStatus", true);
  const id = useId();

  const isDefault =
    displaySleep === DEFAULTS.displaySleep &&
    preventSleep === DEFAULTS.preventSleep &&
    diskSleep === DEFAULTS.diskSleep &&
    wakeForNetwork === DEFAULTS.wakeForNetwork &&
    powerNap === DEFAULTS.powerNap;
  const restoreDefaults = () => {
    setDisplaySleep(DEFAULTS.displaySleep);
    setPreventSleep(DEFAULTS.preventSleep);
    setDiskSleep(DEFAULTS.diskSleep);
    setWakeForNetwork(DEFAULTS.wakeForNetwork);
    setPowerNap(DEFAULTS.powerNap);
  };

  /** The checkboxes under the slider: top edge, title, state. */
  const options = [
    [
      225,
      "Prevent computer from sleeping automatically when the display is off",
      preventSleep,
      setPreventSleep,
    ],
    [248, "Put hard disks to sleep when possible", diskSleep, setDiskSleep],
    [271, "Wake for Wi-Fi network access", wakeForNetwork, setWakeForNetwork],
  ] as const;

  return (
    <>
      <PaneAt x={20} y={60}>
        <Checkbox
          checked={graphics}
          onCheckedChange={setGraphics}
          aria-describedby={`${id}-graphics`}
        >
          Automatic graphics switching
        </Checkbox>
      </PaneAt>
      <PaneAt x={38} y={79.5}>
        <Label id={`${id}-graphics`} textStyle="small">
          Your computer will automatically switch between graphics modes for better battery life.
        </Label>
      </PaneAt>

      <TabView
        value={tab}
        onValueChange={(value) => setTab(value as string)}
        style={{ position: "absolute", left: TABS.x, top: TABS.y - 38, width: 628, height: 333 }}
      >
        {/* The strip is 181 pt wide and half a point to the right of the box's middle. */}
        <TabViewList aria-label="Power source" style={{ marginLeft: 1 }}>
          <TabViewTab value="battery" style={{ width: 68, padding: 0 }}>
            Battery
          </TabViewTab>
          <TabViewTab value="power-adapter" style={{ width: 113, padding: 0 }}>
            Power Adapter
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="battery">
          <EmptyState>The Battery tab is not part of this demo.</EmptyState>
        </TabViewPanel>
        <TabViewPanel value="power-adapter">
          <PaneForm origin={TABS} labelWidth={165} gap={11}>
            <PaneRow
              y={167.5}
              label="Turn display off after:"
              labelId={`${id}-display`}
              labelOffset={-5}
            >
              <Slider
                aria-labelledby={`${id}-display`}
                min={0}
                max={MARKS - 1}
                tickMarks={MARKS}
                tickMarkValuesOnly
                value={displaySleep}
                onValueChange={(value) => setDisplaySleep(value as number)}
                getAriaValueText={(_, value) => delayInWords(value)}
                style={{ width: 434 }}
              />
            </PaneRow>
            {/* Each legend is centred under its mark; the last starts 4.5 pt before its own. */}
            {LEGEND.map(([mark, legend]) =>
              mark === MARKS - 1 ? (
                <PaneAt key={mark} x={598} y={193.5}>
                  <Label textStyle="mini">{legend}</Label>
                </PaneAt>
              ) : (
                <PaneAt
                  key={mark}
                  x={FIRST_MARK + ((LAST_MARK - FIRST_MARK) * mark) / (MARKS - 1) - 30}
                  y={193.5}
                  width={60}
                  style={{ justifyContent: "center" }}
                >
                  <Label textStyle="mini">{legend}</Label>
                </PaneAt>
              ),
            )}

            {options.map(([y, title, checked, setChecked]) => (
              <PaneAt key={title} x={45} y={y}>
                <Checkbox checked={checked} onCheckedChange={setChecked}>
                  {title}
                </Checkbox>
              </PaneAt>
            ))}
            <PaneAt x={45} y={294}>
              <Checkbox
                checked={powerNap}
                onCheckedChange={setPowerNap}
                aria-describedby={`${id}-power-nap`}
              >
                Enable Power Nap while plugged into a power adapter
              </Checkbox>
            </PaneAt>
            <PaneAt x={63.5} y={312.5}>
              <Label id={`${id}-power-nap`} textStyle="small">
                While sleeping, your Mac can back up using Time Machine and periodically check for
                new email,
                <br />
                calendar, and other iCloud updates
              </Label>
            </PaneAt>

            <PaneAt x={62} y={422.5}>
              <Label textStyle="small" style={{ whiteSpace: "pre" }}>
                {batteryStatus}
              </Label>
            </PaneAt>
            <PaneAt x={503} y={415}>
              <PushButton
                disabled={isDefault}
                onClick={restoreDefaults}
                style={{ width: 132, paddingInline: 0 }}
              >
                Restore Defaults
              </PushButton>
            </PaneAt>
          </PaneForm>
        </TabViewPanel>
      </TabView>

      <PaneAt x={20} y={468}>
        <Checkbox checked={menuBar} onCheckedChange={setMenuBar}>
          Show battery status in menu bar
        </Checkbox>
      </PaneAt>
      <PaneAt x={515} y={466}>
        <Uncaptured action="Schedule…">
          <PushButton style={{ width: 98, paddingInline: 0 }}>Schedule…</PushButton>
        </Uncaptured>
      </PaneAt>
      <PaneFooter x={627} y={463}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </>
  );
}
