"use client";

import { EmptyState } from "macalicious/empty-state";
import { GestureOptionRow } from "macalicious/gesture-option-row";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { MenuRadioGroup, MenuRadioItem } from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";
import { PushButton } from "macalicious/push-button";
import { Slider } from "macalicious/slider";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { useId } from "react";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { BatteryArtwork, GestureArtwork } from "./artwork";

/**
 * The tab view's top-left corner in the window frame: the strip is centred on the box's top
 * edge, which is at y 60.
 */
const TABS = { x: 20, y: 50 };

/**
 * Where the first gesture row's box starts in the window frame, and how wide the rows are: the
 * callout of the captures is at x 30 and 311 pt wide, and a row's checkbox is 17.5 pt under
 * the row's top edge (the first checkbox is at y 106). The rows follow each other at the row's
 * own height, 50 pt.
 */
const GESTURES = { x: 30, y: 88.5, width: 311 };

/** The sides a secondary click can be on. */
const SIDES = {
  right: "Click on right side",
  left: "Click on left side",
} as const;

/** Why a setting is dimmed on the served desktop. */
const HARDWARE = "A web page can neither read nor change how your mouse works.";

/**
 * System Preferences > Mouse: the Point & Click tab. In the library demo the settings keep their
 * state and change nothing. On the served desktop Scroll direction works (`scroll-direction.ts`) and
 * the others are dimmed at Catalina's defaults: a page cannot configure a mouse, read its battery or
 * pair one. The callout follows the pointer and the keyboard focus, as the video beside the list does
 * in Catalina; here the picture stays the same. In the library demo the More Gestures tab is not
 * captured and says so; on the served desktop it says what reaches a page, and the invented battery
 * level goes.
 *
 * Distances are those of reference/spec/apps/system-preferences-mouse.md, in points from the
 * top-left corner of the window frame.
 */
export function Mouse() {
  const [tab, setTab] = usePreference<string>("mouse.tab", "point-and-click");
  const [natural, setNatural] = usePreference("mouse.naturalScrolling", true);
  const [secondary, setSecondary] = usePreference("mouse.secondaryClick", false);
  const [side, setSide] = usePreference<keyof typeof SIDES>("mouse.secondaryClickSide", "right");
  const [zoom, setZoom] = usePreference("mouse.smartZoom", false);
  const [speed, setSpeed] = usePreference("mouse.trackingSpeed", 3);
  // The gesture the picture beside the list is about: the row the pointer or the keyboard
  // focus was on last. Both captures have it on the scroll direction.
  const [preview, setPreview] = usePreference<string>("mouse.preview", "scroll-direction");
  const id = useId();
  const served = servedByDesktopApp();

  const gestures = [
    {
      id: "scroll-direction",
      title: "Scroll direction: Natural",
      detail: "Content tracks finger movement",
      checked: natural,
      set: setNatural,
    },
    {
      id: "secondary-click",
      dimmed: served,
      title: "Secondary click",
      // The choice of side is available while the gesture is on; the captures have it off.
      // The button is taller than the line it stands in: the margin puts its title on the
      // line's baseline.
      detail: (
        <PullDownButton
          size="small"
          bordered={false}
          title={SIDES[served ? "right" : side]}
          aria-label={`Secondary click: ${SIDES[served ? "right" : side]}`}
          disabled={served || !secondary}
          style={{ marginTop: -3 }}
        >
          <MenuRadioGroup value={side} onValueChange={(value) => setSide(value)}>
            <MenuRadioItem value="right">{SIDES.right}</MenuRadioItem>
            <MenuRadioItem value="left">{SIDES.left}</MenuRadioItem>
          </MenuRadioGroup>
        </PullDownButton>
      ),
      checked: secondary && !served,
      set: setSecondary,
    },
    {
      id: "smart-zoom",
      dimmed: served,
      title: "Smart zoom",
      detail: "Double-tap with one finger",
      checked: zoom && !served,
      set: setZoom,
    },
  ];

  return (
    <>
      <TabView
        value={tab}
        onValueChange={(value) => setTab(value as string)}
        style={{ position: "absolute", left: TABS.x, top: TABS.y - 38, width: 628, height: 402 }}
      >
        {/* The strip is 215 pt wide and half a point to the right of the box's middle. */}
        <TabViewList aria-label="Mouse" style={{ marginLeft: 1 }}>
          <TabViewTab value="point-and-click" style={{ width: 101, padding: 0 }}>
            Point & Click
          </TabViewTab>
          <TabViewTab value="more-gestures" style={{ width: 114, padding: 0 }}>
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
                    disabled={gesture.dimmed}
                    tabIndex={gesture.dimmed ? 0 : undefined}
                    onCheckedChange={gesture.set}
                    highlighted={preview === gesture.id}
                    onPointerEnter={() => setPreview(gesture.id)}
                    onFocus={() => setPreview(gesture.id)}
                  />
                );
                return gesture.dimmed ? (
                  <div key={gesture.id} title={HARDWARE}>
                    {row}
                  </div>
                ) : (
                  row
                );
              })}
            </PaneAt>

            <PaneAt x={65.5} y={289.5} width={200} style={{ justifyContent: "center" }}>
              <Label id={`${id}-speed`} disabled={served}>
                Tracking speed
              </Label>
            </PaneAt>
            <PaneAt x={93.5} y={311}>
              <Slider
                aria-labelledby={`${id}-speed`}
                min={0}
                max={9}
                tickMarks={10}
                tickMarkValuesOnly
                value={served ? 3 : speed}
                disabled={served}
                title={served ? HARDWARE : undefined}
                onValueChange={(value) => setSpeed(value as number)}
                style={{ width: 144 }}
              />
            </PaneAt>
            <PaneAt x={91.5} y={336}>
              <Label textStyle="mini" disabled={served}>
                Slow
              </Label>
            </PaneAt>
            <PaneAt x={192} y={336} width={50} style={{ justifyContent: "flex-end" }}>
              <Label textStyle="mini" disabled={served}>
                Fast
              </Label>
            </PaneAt>

            {served ? (
              <PaneAt x={39} y={362} width={300}>
                <Label textStyle="small">
                  Turning Scroll direction off reverses scrolling in this desktop's windows, for a
                  mouse and a trackpad alike, as a web page cannot tell them apart. The dimmed
                  settings are your computer's: they show Catalina's defaults, not its own.
                </Label>
              </PaneAt>
            ) : null}

            <PaneAt x={376} y={106}>
              <GestureArtwork />
            </PaneAt>
          </PaneForm>
        </TabViewPanel>
        <TabViewPanel value="more-gestures">
          {served ? (
            <PaneForm origin={TABS}>
              <PaneAt x={60} y={120} width={540}>
                <Label>
                  Swiping between pages and full-screen applications, and Mission Control, belong to
                  your computer, and do not reach a web page. The desktop's menu bar, Dock and Hot
                  Corners do the same work here.
                </Label>
              </PaneAt>
            </PaneForm>
          ) : (
            <EmptyState>The More Gestures tab is not part of this demo.</EmptyState>
          )}
        </TabViewPanel>
      </TabView>

      {served ? (
        <PaneAt x={20.5} y={475}>
          <Label>A web page cannot read your mouse's battery.</Label>
        </PaneAt>
      ) : (
        <>
          <PaneAt x={20.5} y={475}>
            <Label>Mouse battery level:</Label>
          </PaneAt>
          <PaneAt x={148} y={477} style={{ color: "var(--mac-color-label)" }}>
            <BatteryArtwork />
          </PaneAt>
          <PaneAt x={178.5} y={475}>
            <Label>100%</Label>
          </PaneAt>
        </>
      )}
      <PaneAt x={434} y={471}>
        {served ? (
          <PushButton
            disabled
            title="A web page cannot pair a mouse."
            style={{ width: 186, paddingInline: 0 }}
          >
            Set Up Bluetooth Mouse…
          </PushButton>
        ) : (
          <Uncaptured action="Set Up Bluetooth Mouse…">
            <PushButton style={{ width: 186, paddingInline: 0 }}>
              Set Up Bluetooth Mouse…
            </PushButton>
          </Uncaptured>
        )}
      </PaneAt>
      <PaneFooter x={632} y={471}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </>
  );
}
