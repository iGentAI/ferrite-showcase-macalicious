"use client";

import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { GestureOptionRow } from "macalicious/gesture-option-row";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { MenuItem } from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";
import { PushButton } from "macalicious/push-button";
import { Separator } from "macalicious/separator";
import { Slider } from "macalicious/slider";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { type ReactNode, useId } from "react";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { GestureArtwork } from "./artwork";

/**
 * The tab view's top-left corner in the window frame: the strip is centred on the box's top
 * edge, which is at y 68.
 */
const TABS = { x: 20, y: 58 };

const CLICK = ["Light", "Medium", "Firm"] as const;

/** Why a setting is dimmed on the served desktop. */
const HARDWARE = "A web page can neither read nor change how your trackpad works.";

/**
 * Where the first gesture row's box starts in the window frame, and how wide the rows are: the
 * callout of the captures is at x 30 and 311 pt wide, and a row's checkbox is 17.5 pt under
 * the row's top edge (the first checkbox is at y 114). The rows follow each other at the
 * row's own height, 50 pt.
 */
const GESTURES = { x: 30, y: 96.5, width: 311 };
/** The caption of a slider or of one of its tick marks, centred on `x`. */
function Caption({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <PaneAt x={x - 50} y={y} width={100} style={{ justifyContent: "center" }}>
      {children}
    </PaneAt>
  );
}

/**
 * The second line of a gesture that can be made in more than one way: a small pull-down button
 * without a bezel, titled with the way that is chosen, as in Catalina.
 */
function GestureChoice({
  setting,
  options,
}: {
  setting: string;
  /** The ways to make the gesture; the first is the one the captures show. */
  options: readonly [string, ...string[]];
}) {
  const [choice, setChoice] = usePreference<string>(setting, options[0]);
  const served = servedByDesktopApp();
  return (
    <PullDownButton
      title={served ? options[0] : choice}
      size="small"
      bordered={false}
      disabled={served}
    >
      {options.map((option) => (
        <MenuItem key={option} onClick={() => setChoice(option)}>
          {option}
        </MenuItem>
      ))}
    </PullDownButton>
  );
}

/**
 * System Preferences > Trackpad: the Point & Click tab. In the library demo the settings keep their
 * state and change nothing, and the other two tabs are not captured and say so. A page cannot
 * configure a trackpad, so on the served desktop the settings are dimmed at Catalina's defaults, the
 * callout still follows the pointer and the keyboard, and the other tabs say what reaches a page.
 *
 * Distances are those of reference/spec/apps/system-preferences-trackpad.md, in points from
 * the top-left corner of the window frame.
 */
export function Trackpad() {
  const [tab, setTab] = usePreference<string>("trackpad.tab", "point-and-click");
  const [lookUp, setLookUp] = usePreference("trackpad.lookUp", true);
  const [secondary, setSecondary] = usePreference("trackpad.secondaryClick", true);
  const [tap, setTap] = usePreference("trackpad.tapToClick", false);
  const [click, setClick] = usePreference("trackpad.click", 1);
  const [speed, setSpeed] = usePreference("trackpad.trackingSpeed", 3);
  const [force, setForce] = usePreference("trackpad.forceClick", true);
  // The gesture the picture beside the list is about: the row the pointer or the keyboard
  // focus was on last. The Aqua capture has it on Secondary click.
  const [preview, setPreview] = usePreference<string>("trackpad.preview", "secondary-click");
  const id = useId();
  const served = servedByDesktopApp();

  const gestures = [
    {
      id: "look-up",
      title: "Look up & data detectors",
      detail: (
        <GestureChoice
          setting="trackpad.lookUpGesture"
          options={["Force Click with one finger", "Tap with three fingers"]}
        />
      ),
      checked: served ? true : lookUp,
      set: setLookUp,
    },
    {
      id: "secondary-click",
      title: "Secondary click",
      detail: (
        <GestureChoice
          setting="trackpad.secondaryClickGesture"
          options={[
            "Click with two fingers",
            "Click in bottom right corner",
            "Click in bottom left corner",
          ]}
        />
      ),
      checked: served ? true : secondary,
      set: setSecondary,
    },
    {
      id: "tap-to-click",
      title: "Tap to click",
      detail: "Tap with one finger",
      checked: served ? false : tap,
      set: setTap,
    },
  ];

  return (
    <>
      <TabView
        value={tab}
        onValueChange={(value) => setTab(value as string)}
        style={{ position: "absolute", left: TABS.x, top: TABS.y - 38, width: 628, height: 401.5 }}
      >
        <TabViewList aria-label="Trackpad">
          <TabViewTab value="point-and-click" style={{ width: 101, padding: 0 }}>
            Point & Click
          </TabViewTab>
          <TabViewTab value="scroll-and-zoom" style={{ width: 109, padding: 0 }}>
            Scroll & Zoom
          </TabViewTab>
          <TabViewTab value="more-gestures" style={{ width: 112.5, padding: 0 }}>
            More Gestures
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="point-and-click">
          <PaneForm origin={TABS}>
            <PaneAt
              x={GESTURES.x}
              y={GESTURES.y}
              width={GESTURES.width}
              style={{ display: "block" }}
            >
              {gestures.map((gesture) => {
                const row = (
                  <GestureOptionRow
                    key={gesture.id}
                    data-gesture={gesture.id}
                    title={gesture.title}
                    detail={gesture.detail}
                    checked={gesture.checked}
                    disabled={served}
                    tabIndex={served ? 0 : undefined}
                    onCheckedChange={gesture.set}
                    highlighted={preview === gesture.id}
                    onPointerEnter={() => setPreview(gesture.id)}
                    onFocus={() => setPreview(gesture.id)}
                  />
                );
                return served ? (
                  <div key={gesture.id} title={HARDWARE}>
                    {row}
                  </div>
                ) : (
                  row
                );
              })}
            </PaneAt>

            <PaneAt x={39} y={266} width={287}>
              <Separator aria-hidden="true" style={{ flex: 1 }} />
            </PaneAt>

            <Caption x={109} y={277.5}>
              <Label id={`${id}-click`} disabled={served}>
                Click
              </Label>
            </Caption>
            <PaneAt x={58} y={303}>
              <Slider
                size="small"
                aria-labelledby={`${id}-click`}
                min={0}
                max={2}
                tickMarks={3}
                tickMarkValuesOnly
                value={served ? 1 : click}
                disabled={served}
                title={served ? HARDWARE : undefined}
                onValueChange={(value) => setClick(value as number)}
                getAriaValueText={(_, value) => CLICK[value] ?? ""}
                style={{ width: 102 }}
              />
            </PaneAt>
            <Caption x={64} y={320.5}>
              <Label textStyle="mini" disabled={served}>
                Light
              </Label>
            </Caption>
            <Caption x={109} y={320.5}>
              <Label textStyle="mini" disabled={served}>
                Medium
              </Label>
            </Caption>
            <Caption x={153.5} y={320.5}>
              <Label textStyle="mini" disabled={served}>
                Firm
              </Label>
            </Caption>

            <Caption x={262.5} y={277.5}>
              <Label id={`${id}-speed`} disabled={served}>
                Tracking speed
              </Label>
            </Caption>
            <PaneAt x={212} y={303}>
              <Slider
                size="small"
                aria-labelledby={`${id}-speed`}
                min={0}
                max={9}
                tickMarks={10}
                tickMarkValuesOnly
                value={served ? 3 : speed}
                disabled={served}
                title={served ? HARDWARE : undefined}
                onValueChange={(value) => setSpeed(value as number)}
                style={{ width: 102 }}
              />
            </PaneAt>
            <Caption x={217.5} y={320.5}>
              <Label textStyle="mini" disabled={served}>
                Slow
              </Label>
            </Caption>
            <Caption x={308} y={320.5}>
              <Label textStyle="mini" disabled={served}>
                Fast
              </Label>
            </Caption>

            <PaneAt x={39} y={352} width={287}>
              <Separator aria-hidden="true" style={{ flex: 1 }} />
            </PaneAt>

            <PaneAt x={39} y={376}>
              <Checkbox
                checked={served ? true : force}
                disabled={served}
                title={served ? HARDWARE : undefined}
                onCheckedChange={setForce}
                aria-describedby={`${id}-force`}
              >
                <span style={{ position: "relative", top: 0.5, left: 4.5 }}>
                  Force Click and haptic feedback
                </span>
              </Checkbox>
            </PaneAt>
            <PaneAt x={61.5} y={394}>
              <Label id={`${id}-force`} textStyle="small" disabled={served}>
                Click then press firmly for Quick Look, Look up,
                <br />
                and variable speed media controls.
              </Label>
            </PaneAt>

            {served ? (
              <PaneAt x={374} y={418} width={270}>
                <Label textStyle="small">
                  A web page cannot read or change these. They show Catalina's defaults, not this
                  computer's.
                </Label>
              </PaneAt>
            ) : null}

            <PaneAt x={374} y={113}>
              <GestureArtwork />
            </PaneAt>
          </PaneForm>
        </TabViewPanel>
        <TabViewPanel value="scroll-and-zoom">
          {served ? (
            <PaneForm origin={TABS}>
              <PaneAt x={60} y={120} width={540}>
                <Label>
                  Your computer decides how your trackpad scrolls and zooms, and this desktop gets
                  the result as any web page does: two fingers scroll the view under the pointer,
                  and a pinch reaches your browser, which zooms the page. Smart Zoom and Rotate do
                  not reach a web page.
                </Label>
              </PaneAt>
            </PaneForm>
          ) : (
            <EmptyState>The Scroll & Zoom tab is not part of this demo.</EmptyState>
          )}
        </TabViewPanel>
        <TabViewPanel value="more-gestures">
          {served ? (
            <PaneForm origin={TABS}>
              <PaneAt x={60} y={120} width={540}>
                <Label>
                  Swiping between pages, swiping between full-screen applications, Notification
                  Center and Mission Control belong to your computer, and do not reach a web page.
                  The desktop's menu bar, Dock and Hot Corners do the same work here.
                </Label>
              </PaneAt>
            </PaneForm>
          ) : (
            <EmptyState>The More Gestures tab is not part of this demo.</EmptyState>
          )}
        </TabViewPanel>
      </TabView>

      <PaneFooter right={20} y={474} style={{ gap: 12 }}>
        {/* 201 pt wide in the captures; wider when the fallback font needs it. */}
        {served ? (
          <PushButton disabled title="A web page cannot pair a trackpad." style={{ minWidth: 201 }}>
            Set Up Bluetooth Trackpad...
          </PushButton>
        ) : (
          <Uncaptured action="Set Up Bluetooth Trackpad...">
            <PushButton style={{ minWidth: 201 }}>Set Up Bluetooth Trackpad...</PushButton>
          </Uncaptured>
        )}
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </>
  );
}
