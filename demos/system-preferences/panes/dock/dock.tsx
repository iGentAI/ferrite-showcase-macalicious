"use client";

import { Checkbox } from "macalicious/checkbox";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { Slider } from "macalicious/slider";
import { useId } from "react";
import { PaneChoice } from "../../choice";
import { PaneAt, PaneFooter, PaneForm, PaneRow } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";

const POSITIONS = [
  ["left", "Left"],
  ["bottom", "Bottom"],
  ["right", "Right"],
] as const;

/** The checkboxes under the pop-up buttons: key, top edge, title, state in the capture. */
const OPTIONS = [
  ["minimizeIntoIcon", 284, "Minimize windows into application icon", false],
  ["animate", 304, "Animate opening applications", true],
  ["autohide", 324, "Automatically hide and show the Dock", false],
  ["indicators", 344, "Show indicators for open applications", true],
  ["recents", 365.5, "Show recent applications in Dock", true],
] as const;

function Option({ id, y, title, on }: { id: string; y: number; title: string; on: boolean }) {
  const [checked, setChecked] = usePreference(`dock.${id}`, on);
  return (
    <PaneRow y={y}>
      <Checkbox checked={checked} onCheckedChange={setChecked}>
        {title}
      </Checkbox>
    </PaneRow>
  );
}

/**
 * System Preferences > Dock. On the desktop served by Ferrite the settings move the real Dock at
 * once and are kept per person: its size, magnification, edge and auto-hide
 * (`demos/desktop/desktop-personal.ts` reads them with the same keys and defaults, through the
 * person's settings session). Elsewhere, and for the other settings, they keep their state and
 * change nothing.
 *
 * Distances are those of reference/spec/apps/system-preferences-dock.md, in points from the
 * top-left corner of the window frame.
 */
export function Dock() {
  const [size, setSize] = usePreference("dock.size", 42.5);
  const [magnify, setMagnify] = usePreference("dock.magnification", false);
  const [magnification, setMagnification] = usePreference("dock.magnificationSize", 100);
  const [position, setPosition] = usePreference<string>("dock.position", "bottom");
  const [doubleClick, setDoubleClick] = usePreference("dock.doubleClickTitleBar", true);
  const id = useId();

  return (
    <PaneForm labelWidth={257} gap={8.5}>
      <PaneRow y={61.5} label="Size:" labelId={`${id}-size`} labelOffset={-3.5}>
        <Slider
          aria-labelledby={`${id}-size`}
          tickMarks={2}
          value={size}
          onValueChange={(value) => setSize(value as number)}
          style={{ width: 202, marginLeft: 1 }}
        />
      </PaneRow>
      <PaneAt x={262} y={84}>
        <Label textStyle="mini">Small</Label>
      </PaneAt>
      <PaneAt x={448.5} y={84}>
        <Label textStyle="mini">Large</Label>
      </PaneAt>

      <PaneAt x={153.5} y={108}>
        <Checkbox checked={magnify} onCheckedChange={setMagnify}>
          Magnification:
        </Checkbox>
      </PaneAt>
      <PaneAt x={266.5} y={109.5}>
        <Slider
          aria-label="Magnification"
          tickMarks={2}
          value={magnification}
          onValueChange={(value) => setMagnification(value as number)}
          style={{ width: 202 }}
        />
      </PaneAt>
      <PaneAt x={265} y={132}>
        <Label textStyle="mini">Min</Label>
      </PaneAt>
      <PaneAt x={452.5} y={132}>
        <Label textStyle="mini">Max</Label>
      </PaneAt>

      <PaneRow y={159} label="Position on screen:" labelId={`${id}-position`} labelOffset={-1}>
        <RadioGroup
          aria-labelledby={`${id}-position`}
          orientation="horizontal"
          value={position}
          onValueChange={(value) => setPosition(value as string)}
          style={{ marginLeft: 16.5, gap: 33 }}
        >
          {POSITIONS.map(([value]) => (
            <RadioButton key={value} value={value} aria-labelledby={`${id}-${value}`} />
          ))}
        </RadioGroup>
      </PaneRow>
      {/* The titles sit under the buttons, each centred on its own: 49 pt from one to the next. */}
      {POSITIONS.map(([value, title], index) => (
        <PaneAt
          key={value}
          x={260 + index * 49}
          y={178.5}
          width={60}
          style={{ justifyContent: "center" }}
        >
          <Label id={`${id}-${value}`} onClick={() => setPosition(value)}>
            {title}
          </Label>
        </PaneAt>
      ))}

      {/* The pop-up buttons' boxes start half a point before their bezels, which are at
          x 265.5: the controls' column. */}
      <PaneRow y={204.5} label="Minimize windows using:" labelId={`${id}-minimize`} labelOffset={2}>
        <PaneChoice
          setting="dock.minimizeEffect"
          options={["Genie effect", "Scale effect"]}
          initial="Genie effect"
          width={108.5}
          aria-labelledby={`${id}-minimize`}
          style={{ marginLeft: -0.5 }}
        />
      </PaneRow>
      <PaneRow
        y={231}
        label="Prefer tabs when opening documents:"
        labelId={`${id}-tabs`}
        labelOffset={2.5}
      >
        <PaneChoice
          setting="dock.preferTabs"
          options={["Always", "In Full Screen Only", "Manually"]}
          initial="In Full Screen Only"
          width={147}
          aria-labelledby={`${id}-tabs`}
          style={{ marginLeft: -0.5 }}
        />
      </PaneRow>

      <PaneRow y={262}>
        <Checkbox checked={doubleClick} onCheckedChange={setDoubleClick}>
          Double-click a window’s title bar to
        </Checkbox>
      </PaneRow>
      <PaneAt x={504} y={259}>
        <PaneChoice
          setting="dock.doubleClickAction"
          options={["zoom", "minimize"]}
          initial="zoom"
          width={87.5}
          aria-label="Double-click a window’s title bar to"
          disabled={!doubleClick}
        />
      </PaneAt>
      {OPTIONS.map(([key, y, title, on]) => (
        <Option key={key} id={key} y={y} title={title} on={on} />
      ))}

      <PaneFooter right={20} y={366}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}
