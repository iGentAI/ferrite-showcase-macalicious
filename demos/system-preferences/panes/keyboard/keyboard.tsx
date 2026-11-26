"use client";

import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { Slider } from "macalicious/slider";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { useId } from "react";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneChoice } from "../../choice";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { ServedDictation } from "./served-dictation";
import { ServedShortcuts, ServedStatement, ServedText } from "./served-keyboard";

/** The tab view's top-left corner in the window frame: the strip is centred on the box's edge. */
const TABS = { x: 20, y: 63 };

/** The tabs with the widths measured in the capture. */
const TAB_LIST = [
  ["keyboard", "Keyboard", 81.5],
  ["text", "Text", 49],
  ["shortcuts", "Shortcuts", 82],
  ["input-sources", "Input Sources", 106],
  ["dictation", "Dictation", 77.5],
] as const;

/** Why a setting is dimmed on the served desktop. */
const HARDWARE = "A web page can neither read nor change how your keyboard works.";

/** A pop-up button of a pane, kept with its setting, or dimmed at its first choice on the served desktop. */
function Choice({
  setting,
  options,
  width,
  ...naming
}: {
  setting: string;
  options: readonly [string, ...string[]];
  width: number;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const [initial] = options;
  return servedByDesktopApp() ? (
    <PopUpButton disabled title={HARDWARE} value={initial} style={{ width }} {...naming}>
      <PopUpButtonItem value={initial}>{initial}</PopUpButtonItem>
    </PopUpButton>
  ) : (
    <PaneChoice setting={setting} options={options} initial={initial} width={width} {...naming} />
  );
}

/** A stepped slider under its centred title, with captions at the ends of its track. */
function Rate({
  x,
  title,
  steps,
  value,
  onValueChange,
  captions,
  dimmed,
}: {
  x: number;
  title: string;
  steps: number;
  value: number;
  onValueChange: (value: number) => void;
  /** Captions under the track: text and left edge in the window frame. */
  captions: readonly (readonly [text: string, x: number])[];
  /** Why the slider is dimmed, when it is. */
  dimmed?: string;
}) {
  const id = useId();
  return (
    <>
      <PaneAt x={x} y={110.5} width={148} style={{ justifyContent: "center" }}>
        <Label id={id} disabled={dimmed !== undefined}>
          {title}
        </Label>
      </PaneAt>
      <PaneAt x={x} y={137.5}>
        <Slider
          aria-labelledby={id}
          min={0}
          max={steps - 1}
          tickMarks={steps}
          tickMarkValuesOnly
          value={value}
          disabled={dimmed !== undefined}
          title={dimmed}
          onValueChange={(next) => onValueChange(next as number)}
          style={{ width: 148 }}
        />
      </PaneAt>
      {captions.map(([text, left]) => (
        <PaneAt key={text} x={left} y={160}>
          <Label textStyle="mini" disabled={dimmed !== undefined}>
            {text}
          </Label>
        </PaneAt>
      ))}
    </>
  );
}

/** A button of the pane: dimmed with the reason on the served desktop, a popover in the library demo. */
function HardwareButton({ title, width }: { title: string; width: number }) {
  const button = <PushButton style={{ width, paddingInline: 0 }}>{title}</PushButton>;
  return servedByDesktopApp() ? (
    <PushButton disabled title={HARDWARE} style={{ width, paddingInline: 0 }}>
      {title}
    </PushButton>
  ) : (
    <Uncaptured action={title}>{button}</Uncaptured>
  );
}

/**
 * System Preferences > Keyboard: the Keyboard tab. In the library demo the settings keep their state
 * and change nothing, and the other tabs say they are not part of it. On the served desktop the
 * settings of the keyboard itself are dimmed at Catalina's defaults, as a web page has no say over
 * them; the viewers' check box works (`viewers-extra.tsx`) and the other tabs are `served-keyboard.tsx`.
 *
 * Distances are those of reference/spec/apps/system-preferences-keyboard.md, in points from
 * the top-left corner of the window frame.
 */
export function Keyboard() {
  const [tab, setTab] = usePreference<string>("keyboard.tab", "keyboard");
  const [repeat, setRepeat] = usePreference("keyboard.keyRepeat", 6);
  const [delay, setDelay] = usePreference("keyboard.delayUntilRepeat", 2);
  const [brightness, setBrightness] = usePreference("keyboard.adjustBrightness", true);
  const [backlightOff, setBacklightOff] = usePreference("keyboard.backlightOff", false);
  const [controlStrip, setControlStrip] = usePreference("keyboard.showControlStrip", true);
  const [viewers, setViewers] = usePreference("keyboard.showViewers", false);
  const id = useId();
  const served = servedByDesktopApp();
  const dimmed = served ? HARDWARE : undefined;

  return (
    <>
      <TabView
        value={tab}
        onValueChange={(value) => setTab(value as string)}
        style={{ position: "absolute", left: TABS.x, top: TABS.y - 38, width: 628, height: 461.5 }}
      >
        <TabViewList aria-label="Keyboard">
          {TAB_LIST.map(([value, title, width]) => (
            <TabViewTab key={value} value={value} style={{ width, padding: 0 }}>
              {title}
            </TabViewTab>
          ))}
        </TabViewList>
        <TabViewPanel value="keyboard">
          <PaneForm origin={TABS}>
            <Rate
              x={139}
              title="Key Repeat"
              steps={8}
              value={served ? 6 : repeat}
              onValueChange={setRepeat}
              dimmed={dimmed}
              captions={[
                ["Off", 138],
                ["Slow", 159],
                ["Fast", 271],
              ]}
            />
            <Rate
              x={380}
              title="Delay Until Repeat"
              steps={6}
              value={served ? 2 : delay}
              onValueChange={setDelay}
              dimmed={dimmed}
              captions={[
                ["Long", 375],
                ["Short", 506],
              ]}
            />

            <PaneAt x={88} y={202}>
              <Checkbox
                checked={served ? true : brightness}
                disabled={served}
                title={dimmed}
                onCheckedChange={setBrightness}
              >
                Adjust keyboard brightness in low light
              </Checkbox>
            </PaneAt>
            <PaneAt x={88} y={228}>
              <Checkbox
                checked={served ? false : backlightOff}
                disabled={served}
                title={dimmed}
                onCheckedChange={setBacklightOff}
              >
                Turn keyboard backlight off after
              </Checkbox>
            </PaneAt>
            <PaneAt x={311} y={225}>
              <Choice
                setting="keyboard.backlightDelay"
                options={["5 secs", "10 secs", "30 secs", "1 min", "5 mins"]}
                width={81}
                aria-label="Turn keyboard backlight off after"
              />
            </PaneAt>
            <PaneAt x={398.5} y={227}>
              <Label disabled={served}>of inactivity</Label>
            </PaneAt>

            {/* The two labels end at different places, so each pop-up button is placed on its
                own: their bezels start at x 199.5 and x 189. */}
            <PaneAt x={88.5} y={270.5}>
              <Label id={`${id}-touch-bar`} disabled={served}>
                Touch Bar shows
              </Label>
            </PaneAt>
            <PaneAt x={199} y={268}>
              <Choice
                setting="keyboard.touchBarShows"
                options={[
                  "App Controls",
                  "Expanded Control Strip",
                  "F1, F2, etc. Keys",
                  "Quick Actions",
                  "Spaces",
                ]}
                width={174}
                aria-labelledby={`${id}-touch-bar`}
              />
            </PaneAt>
            <PaneAt x={89} y={301}>
              <Label id={`${id}-fn`} disabled={served}>
                Press Fn key to
              </Label>
            </PaneAt>
            <PaneAt x={188.5} y={299}>
              <Choice
                setting="keyboard.fnKey"
                options={[
                  "Show F1, F2, etc. Keys",
                  "Expand Control Strip",
                  "Show Quick Actions",
                  "Show Spaces",
                ]}
                width={168}
                aria-labelledby={`${id}-fn`}
              />
            </PaneAt>
            <PaneAt x={388} y={271}>
              <Checkbox
                checked={served ? true : controlStrip}
                disabled={served}
                title={dimmed}
                onCheckedChange={setControlStrip}
              >
                Show Control Strip
              </Checkbox>
            </PaneAt>

            <PaneAt x={88} y={346}>
              <Checkbox checked={viewers} onCheckedChange={setViewers}>
                Show keyboard and emoji viewers in menu bar
              </Checkbox>
            </PaneAt>

            {served ? (
              <PaneAt x={88} y={385} width={510}>
                <Label textStyle="small">
                  {HARDWARE} The dimmed settings show Catalina's defaults, not this computer's.
                </Label>
              </PaneAt>
            ) : null}

            <PaneAt x={312.5} y={484}>
              <HardwareButton title="Customize Control Strip…" width={182} />
            </PaneAt>
            <PaneAt x={507.5} y={484}>
              <HardwareButton title="Modifier Keys…" width={120} />
            </PaneAt>
          </PaneForm>
        </TabViewPanel>
        {TAB_LIST.slice(1).map(([value, title]) => (
          <TabViewPanel key={value} value={value}>
            {!served ? (
              <EmptyState>The {title} tab is not part of this demo.</EmptyState>
            ) : value === "text" ? (
              <ServedText />
            ) : value === "shortcuts" ? (
              <ServedShortcuts />
            ) : value === "dictation" ? (
              <ServedDictation />
            ) : (
              <ServedStatement />
            )}
          </TabViewPanel>
        ))}
      </TabView>

      <PaneForm>
        <PaneAt x={409.5} y={543}>
          <HardwareButton title="Set Up Bluetooth Keyboard…" width={202} />
        </PaneAt>
        <PaneFooter x={625} y={542.5}>
          <Uncaptured action="Help">
            <HelpButton />
          </Uncaptured>
        </PaneFooter>
      </PaneForm>
    </>
  );
}
