"use client";

import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { Slider } from "macalicious/slider";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { useId } from "react";
import { PaneChoice } from "../../choice";
import { PaneAt, PaneFooter, PaneForm, PaneRow } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { DisplayArtwork } from "./artwork";

/**
 * The tab view's top-left corner in the window frame: the strip is centred on the box's top
 * edge, which is at y 68.
 */
const TABS = { x: 20, y: 58 };

/**
 * System Preferences > Displays, for a built-in display. The settings keep their state and
 * change nothing: a page cannot set the resolution or the brightness of a screen. Only the
 * Display tab is captured; the other two say so.
 *
 * Distances are those of reference/spec/apps/system-preferences-displays.md, in points from
 * the top-left corner of the window frame.
 */
export function Displays() {
  const [tab, setTab] = usePreference<string>("displays.tab", "display");
  const [resolution, setResolution] = usePreference<string>("displays.resolution", "default");
  const [brightness, setBrightness] = usePreference("displays.brightness", 80.5);
  const [autoBrightness, setAutoBrightness] = usePreference("displays.autoBrightness", true);
  const [trueTone, setTrueTone] = usePreference("displays.trueTone", true);
  const [mirroring, setMirroring] = usePreference("displays.showMirroring", true);
  const id = useId();

  return (
    <>
      <TabView
        value={tab}
        onValueChange={(value) => setTab(value as string)}
        style={{ position: "absolute", left: TABS.x, top: TABS.y - 38, width: 628, height: 376 }}
      >
        {/* The capture's strip is half a point right of the box's centre. */}
        <TabViewList aria-label="Displays" style={{ left: 0.5 }}>
          <TabViewTab value="display" style={{ width: 69, padding: 0 }}>
            Display
          </TabViewTab>
          <TabViewTab value="color" style={{ width: 55.5, padding: 0 }}>
            Color
          </TabViewTab>
          <TabViewTab value="night-shift" style={{ width: 88.5, padding: 0 }}>
            Night Shift
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="display">
          <PaneForm origin={TABS} labelWidth={360} gap={11}>
            <PaneAt x={58} y={105}>
              <DisplayArtwork />
            </PaneAt>

            <PaneRow y={104} label="Resolution:" labelId={`${id}-resolution`}>
              <RadioGroup
                aria-labelledby={`${id}-resolution`}
                value={resolution}
                onValueChange={(value) => setResolution(value as string)}
                style={{ gap: 4 }}
              >
                <RadioButton value="default">Default for display</RadioButton>
                <RadioButton value="scaled">Scaled</RadioButton>
              </RadioGroup>
            </PaneRow>

            <PaneRow
              y={157}
              label="Brightness:"
              labelId={`${id}-brightness`}
              labelOffset={-1.5}
              style={{ columnGap: 12 }}
            >
              <Slider
                aria-labelledby={`${id}-brightness`}
                step={0.5}
                largeStep={10}
                value={brightness}
                onValueChange={(value) => setBrightness(value as number)}
                style={{ width: 240 }}
              />
            </PaneRow>
            <PaneAt x={373} y={181}>
              <Checkbox checked={autoBrightness} onCheckedChange={setAutoBrightness}>
                Automatically adjust brightness
              </Checkbox>
            </PaneAt>
            <PaneAt x={373} y={206}>
              <Checkbox
                checked={trueTone}
                onCheckedChange={setTrueTone}
                aria-describedby={`${id}-true-tone-note`}
              >
                True Tone
              </Checkbox>
            </PaneAt>
            <PaneAt x={392} y={226}>
              <Label id={`${id}-true-tone-note`} textStyle="small">
                Automatically adapt display to make colors
                <br />
                appear consistent in different ambient
                <br />
                lighting conditions.
              </Label>
            </PaneAt>
          </PaneForm>
        </TabViewPanel>
        <TabViewPanel value="color">
          <EmptyState>The Color tab is not part of this demo.</EmptyState>
        </TabViewPanel>
        <TabViewPanel value="night-shift">
          <EmptyState>The Night Shift tab is not part of this demo.</EmptyState>
        </TabViewPanel>
      </TabView>

      <PaneAt x={25.5} y={447.5}>
        <Label id={`${id}-airplay`}>AirPlay Display:</Label>
      </PaneAt>
      <PaneAt x={126} y={445.5}>
        <PaneChoice
          setting="displays.airPlayDisplay"
          options={["Off"]}
          initial="Off"
          width={263}
          aria-labelledby={`${id}-airplay`}
        />
      </PaneAt>

      <PaneAt x={20} y={482}>
        <Checkbox checked={mirroring} onCheckedChange={setMirroring}>
          Show mirroring options in the menu bar when available
        </Checkbox>
      </PaneAt>
      <PaneFooter right={20} y={479}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </>
  );
}
