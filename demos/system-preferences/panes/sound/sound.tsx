"use client";

import { Box } from "macalicious/box";
import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { Slider } from "macalicious/slider";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { type CSSProperties, useEffect, useId, useState } from "react";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneChoice } from "../../choice";
import { PaneAt, PaneFooter, PaneForm, PaneRow } from "../../form";
import { usePreference } from "../../pane";
import { FULL_OUTPUT_VOLUME, playAlert, playVolumeFeedback } from "./alert-sounds";
import { SpeakerHigh, SpeakerLow } from "./artwork";
import "./sound.css";
import { Uncaptured } from "../uncaptured";

/** The tab view's top-left corner in the window frame: the strip is centred on the box's edge. */
const TABS = { x: 20, y: 58.5 };

const ALERTS = [
  "Basso",
  "Blow",
  "Bottle",
  "Frog",
  "Funk",
  "Glass",
  "Hero",
  "Morse",
  "Ping",
  "Pop",
  "Purr",
  "Sosumi",
  "Submarine",
  "Tink",
];

const COLUMNS: TableViewColumn[] = [
  { id: "name", title: "Name", width: 348 },
  { id: "type", title: "Type" },
];

/**
 * The Output or Input tab on a served desktop: the devices the browser lists. A browser names them
 * only after the page has been allowed a microphone, and a page cannot choose the system's device.
 */
function AudioDevices({ kind }: { kind: "audiooutput" | "audioinput" }) {
  const [names, setNames] = useState<readonly string[] | null>(null);
  useEffect(() => {
    let live = true;
    const list = navigator.mediaDevices?.enumerateDevices?.();
    if (!list) {
      setNames([]);
      return;
    }
    list.then(
      (devices) => {
        if (!live) return;
        setNames(
          devices
            .filter((device) => device.kind === kind)
            .map(
              (device, index) => device.label || `Device ${index + 1} (name hidden by the browser)`,
            ),
        );
      },
      () => {
        if (live) setNames([]);
      },
    );
    return () => {
      live = false;
    };
  }, [kind]);
  return (
    <EmptyState>
      {names === null
        ? "Reading…"
        : names.length === 0
          ? "This browser lists no devices of this kind."
          : names.join(", ")}
      <br />A web page cannot choose your computer's sound device.
    </EmptyState>
  );
}

/** A volume slider between its two speaker glyphs, at the measured places of a row. */
function Volume({
  y,
  labelledBy,
  value,
  onValueChange,
  onValueCommitted,
}: {
  y: number;
  labelledBy: string;
  value: number;
  onValueChange: (value: number) => void;
  /** Called when the person lets go of the slider. */
  onValueCommitted?: (value: number) => void;
}) {
  return (
    <>
      <PaneAt x={230} y={y} className="mac-system-preferences-sound-speaker">
        <SpeakerLow />
      </PaneAt>
      <PaneAt x={262} y={y + 0.5}>
        <Slider
          aria-labelledby={labelledBy}
          tickMarks={5}
          value={value}
          onValueChange={(next) => onValueChange(next as number)}
          onValueCommitted={(next) => onValueCommitted?.(next as number)}
          style={{ width: 184 }}
        />
      </PaneAt>
      <PaneAt x={457} y={y - 3} className="mac-system-preferences-sound-speaker">
        <SpeakerHigh />
      </PaneAt>
    </>
  );
}

/**
 * System Preferences > Sound: the Sound Effects tab, and the output volume under the tabs. In the
 * library demo the settings keep their state and play nothing. On the served desktop they govern
 * what this desktop plays (`alert-sounds.ts`, `output-volume.ts`, `volume-extra.tsx`), Output volume
 * starts at full, and the computer's own device and volume are out of reach, as the pane says.
 *
 * Distances are those of reference/spec/apps/system-preferences-sound.md, in points from the
 * top-left corner of the window frame.
 */
export function Sound() {
  const [tab, setTab] = usePreference<string>("sound.tab", "effects");
  const [alert, setAlert] = usePreference<string>("sound.alert", "Funk");
  const [alertVolume, setAlertVolume] = usePreference("sound.alertVolume", 100);
  const [interfaceSounds, setInterfaceSounds] = usePreference("sound.interfaceSounds", true);
  const [feedback, setFeedback] = usePreference("sound.volumeFeedback", false);
  const served = servedByDesktopApp();
  const [volume, setVolume] = usePreference("sound.outputVolume", served ? FULL_OUTPUT_VOLUME : 56);
  const [mute, setMute] = usePreference("sound.mute", false);
  const [inMenuBar, setInMenuBar] = usePreference("sound.showInMenuBar", false);
  const id = useId();

  return (
    <>
      <TabView
        value={tab}
        onValueChange={(value) => setTab(value as string)}
        style={{ position: "absolute", left: TABS.x, top: TABS.y - 38, width: 628, height: 353.5 }}
      >
        <TabViewList aria-label="Sound">
          <TabViewTab value="effects" style={{ width: 109, padding: 0 }}>
            Sound Effects
          </TabViewTab>
          <TabViewTab value="output" style={{ width: 65, padding: 0 }}>
            Output
          </TabViewTab>
          <TabViewTab value="input" style={{ width: 54.5, padding: 0 }}>
            Input
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="effects">
          <PaneForm origin={TABS} labelWidth={219.5} gap={10.5}>
            <PaneAt x={43.5} y={93.5}>
              <Label id={`${id}-alerts`} textStyle="emphasized">
                Select an alert sound:
              </Label>
            </PaneAt>
            <PaneAt x={42} y={119}>
              {/* The bordered well of a pane's main list; the table fills it to the border. */}
              <Box
                variant="content"
                aria-labelledby={`${id}-alerts`}
                style={{ width: 583, height: 140, "--mac-box-padding": "0px" } as CSSProperties}
              >
                <TableView
                  aria-labelledby={`${id}-alerts`}
                  columns={COLUMNS}
                  rowCount={ALERTS.length}
                  rowHeight={20}
                  getRowId={(row) => ALERTS[row] ?? row}
                  getRowLabel={(row) => ALERTS[row] ?? ""}
                  renderCell={(row, column) => (column.id === "name" ? ALERTS[row] : "Built-in")}
                  value={[alert]}
                  onValueChange={(value) => {
                    const [next] = value;
                    if (typeof next !== "string") return;
                    setAlert(next);
                    if (served && !mute) playAlert(next, alertVolume);
                  }}
                  style={{ width: 581, height: 138 }}
                />
              </Box>
            </PaneAt>

            <PaneRow
              y={272.5}
              label="Play sound effects through:"
              labelId={`${id}-effects-output`}
              labelOffset={2.5}
            >
              {served ? (
                <PopUpButton
                  disabled
                  title="A web page cannot choose your computer's sound device: this desktop plays through the one your computer has selected."
                  value="Selected sound output device"
                  aria-labelledby={`${id}-effects-output`}
                  style={{ width: 257 }}
                >
                  <PopUpButtonItem value="Selected sound output device">
                    Selected sound output device
                  </PopUpButtonItem>
                </PopUpButton>
              ) : (
                <PaneChoice
                  setting="sound.effectsOutput"
                  options={["Selected sound output device", "Internal Speakers"]}
                  initial="Selected sound output device"
                  width={257}
                  aria-labelledby={`${id}-effects-output`}
                />
              )}
            </PaneRow>

            <PaneRow
              y={312}
              label="Alert volume:"
              labelId={`${id}-alert-volume`}
              labelOffset={-2.5}
            />
            <Volume
              y={311.5}
              labelledBy={`${id}-alert-volume`}
              value={alertVolume}
              onValueChange={setAlertVolume}
            />

            <PaneRow y={355}>
              <Checkbox checked={interfaceSounds} onCheckedChange={setInterfaceSounds}>
                Play user interface sound effects
              </Checkbox>
            </PaneRow>
            <PaneRow y={379}>
              <Checkbox checked={feedback} onCheckedChange={setFeedback}>
                Play feedback when volume is changed
              </Checkbox>
            </PaneRow>
            <PaneFooter x={614.5} y={378.5}>
              <Uncaptured action="Help">
                <HelpButton />
              </Uncaptured>
            </PaneFooter>
          </PaneForm>
        </TabViewPanel>
        <TabViewPanel value="output">
          {served ? (
            <AudioDevices kind="audiooutput" />
          ) : (
            <EmptyState>The Output tab is not part of this demo.</EmptyState>
          )}
        </TabViewPanel>
        <TabViewPanel value="input">
          {served ? (
            <AudioDevices kind="audioinput" />
          ) : (
            <EmptyState>The Input tab is not part of this demo.</EmptyState>
          )}
        </TabViewPanel>
      </TabView>

      <PaneForm labelWidth={219.5} gap={10.5}>
        <PaneRow y={435} label="Output volume:" labelId={`${id}-volume`} labelOffset={-0.5} />
        <Volume
          y={432.5}
          labelledBy={`${id}-volume`}
          value={volume}
          onValueChange={setVolume}
          onValueCommitted={(next) => {
            if (served && feedback && !mute) playVolumeFeedback(next);
          }}
        />
        <PaneAt x={498} y={435}>
          <Checkbox checked={mute} onCheckedChange={setMute}>
            Mute
          </Checkbox>
        </PaneAt>
        <PaneRow y={465}>
          <Checkbox checked={inMenuBar} onCheckedChange={setInMenuBar}>
            Show volume in menu bar
          </Checkbox>
        </PaneRow>
        {served ? (
          <PaneAt x={420} y={459} width={228}>
            <Label textStyle="small">
              Only what this desktop plays: a web page cannot change your computer's volume.
            </Label>
          </PaneAt>
        ) : null}
      </PaneForm>
    </>
  );
}
