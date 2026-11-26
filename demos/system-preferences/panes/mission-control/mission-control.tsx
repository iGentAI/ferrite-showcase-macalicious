"use client";

import { Box } from "macalicious/box";
import { Checkbox } from "macalicious/checkbox";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem, PopUpButtonSeparator } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { useEffect, useId, useState } from "react";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneAt, PaneFooter, PaneForm, PaneRow } from "../../form";
import { usePreference } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { MissionControlArtwork } from "./artwork";
import { HotCornersButton } from "./served-hot-corners";

/** The two boxes' top-left corners in the window frame. */
const SPACES = { x: 20, y: 117 };
const SHORTCUTS = { x: 20, y: 263 };

/** The checkboxes of the first box: key, top edge, title, state in the captures. */
const OPTIONS = [
  ["rearrange", 129, "Automatically rearrange Spaces based on most recent use", true],
  [
    "switchToSpace",
    156.5,
    "When switching to an application, switch to a Space with open windows for the application",
    true,
  ],
  ["groupByApplication", 184, "Group windows by application", false],
  ["separateSpaces", 210, "Displays have separate Spaces", true],
] as const;

/**
 * The pop-up buttons of the second box: key, top edge, label, shortcut in the captures. The
 * blueprint gives the painted bezel; the control's box is half a point larger on each side.
 */
const SHORTCUT_ROWS = [
  ["missionControl", 312, "Mission Control:", "⌃↑"],
  ["applicationWindows", 340, "Application windows:", "⌃↓"],
  ["showDesktop", 368, "Show Desktop:", "F11"],
] as const;

/** What a shortcut's menu offers: the two arrow shortcuts, the function keys, and none. */
const ARROW_KEYS = ["⌃↑", "⌃↓"];
const FUNCTION_KEYS = Array.from({ length: 13 }, (_, index) => `F${index + 1}`);
const NO_SHORTCUT = "–";
const MOUSE_ROWS = ["Mouse Button 3", "Mouse Button 4", "Mouse Button 5"];

/** The modifiers in the order a menu writes them, those of `key` and those held merged. */
const withModifiers = (held: string, key: string) => {
  const [, own = "", rest = key] = /^([⌃⌥⇧⌘]*)(.*)$/.exec(key) ?? [];
  const all = held + own;
  return `${[..."⌃⌥⇧⌘"].filter((mark) => all.includes(mark)).join("")}${rest}`;
};

/** The modifiers held while a menu is open: its rows offer those shortcuts instead. */
function useHeldModifiers(open: boolean): string {
  const [held, setHeld] = useState("");
  useEffect(() => {
    const follow = (event: KeyboardEvent) =>
      setHeld(
        `${event.ctrlKey ? "⌃" : ""}${event.altKey ? "⌥" : ""}${event.shiftKey ? "⇧" : ""}${event.metaKey ? "⌘" : ""}`,
      );
    const letGo = () => setHeld("");
    window.addEventListener("keydown", follow, true);
    window.addEventListener("keyup", follow, true);
    window.addEventListener("blur", letGo);
    return () => {
      window.removeEventListener("keydown", follow, true);
      window.removeEventListener("keyup", follow, true);
      window.removeEventListener("blur", letGo);
    };
  }, []);
  return open ? held : "";
}

/**
 * The settings that say how a Mac arranges Spaces and displays, which the served desktop does not
 * change: dimmed there, at what it does, with why. The screenshots show them in plain state, so
 * they stay so where nothing is served.
 */
const FIXED: Readonly<Record<string, { checked: boolean; why: string }>> = {
  rearrange: { checked: false, why: "This desktop keeps Spaces in the order you put them." },
  switchToSpace: {
    checked: true,
    why: "This desktop always goes to the Space of the application you switch to.",
  },
  separateSpaces: { checked: true, why: "A web page has one display." },
};

function Option({ id, y, title, on }: { id: string; y: number; title: string; on: boolean }) {
  const [checked, setChecked] = usePreference(`mission-control.${id}`, on);
  const fixed = servedByDesktopApp() ? FIXED[id] : undefined;
  return (
    <PaneAt x={36} y={y}>
      <Checkbox
        checked={fixed ? fixed.checked : checked}
        disabled={fixed !== undefined}
        title={fixed?.why}
        onCheckedChange={setChecked}
      >
        {title}
      </Checkbox>
    </PaneAt>
  );
}

function Shortcut({ id, y, label, keys }: { id: string; y: number; label: string; keys: string }) {
  const [value, setValue] = usePreference<string>(`mission-control.${id}`, keys);
  const [mouse, setMouse] = usePreference<string>(`mission-control.${id}Mouse`, NO_SHORTCUT);
  const [open, setOpen] = useState(false);
  const held = useHeldModifiers(open);
  const labelId = useId();
  const listed = [...ARROW_KEYS, ...FUNCTION_KEYS, NO_SHORTCUT].includes(value);
  return (
    <PaneRow y={y} label={label} labelId={labelId} labelOffset={3}>
      <PopUpButton
        aria-labelledby={labelId}
        value={value}
        onValueChange={(next) => setValue(next as string)}
        onOpenChange={setOpen}
        style={{ width: 162 }}
      >
        {ARROW_KEYS.map((key) => (
          <PopUpButtonItem key={key} value={withModifiers(held, key)}>
            {withModifiers(held, key)}
          </PopUpButtonItem>
        ))}
        <PopUpButtonSeparator />
        {FUNCTION_KEYS.map((key) => (
          // F3 always opens Mission Control on the served desktop, so it can be no other's.
          <PopUpButtonItem
            key={key}
            value={withModifiers(held, key)}
            disabled={
              key === "F3" && held === "" && id !== "missionControl" && servedByDesktopApp()
            }
          >
            {withModifiers(held, key)}
          </PopUpButtonItem>
        ))}
        <PopUpButtonSeparator />
        <PopUpButtonItem value={NO_SHORTCUT}>{NO_SHORTCUT}</PopUpButtonItem>
        {listed ? null : <PopUpButtonItem value={value}>{value}</PopUpButtonItem>}
      </PopUpButton>
      {servedByDesktopApp() ? (
        <PopUpButton
          aria-label={`${label} mouse button`}
          value={mouse}
          onValueChange={(next) => setMouse(next as string)}
          style={{ width: 162, marginInlineStart: 8 }}
        >
          <PopUpButtonItem value={NO_SHORTCUT}>{NO_SHORTCUT}</PopUpButtonItem>
          {MOUSE_ROWS.map((button) => (
            <PopUpButtonItem key={button} value={button}>
              {button}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      ) : null}
    </PaneRow>
  );
}

/**
 * System Preferences > Mission Control. Outside the served desktop the settings keep their state and
 * move no window, and Hot Corners says that its dialog is not part of the demo (it is in no capture).
 * On the served desktop Group windows by application, the three shortcuts and Hot Corners work
 * (`hot-corners.ts`, `useWindowShortcuts`), and the settings that cannot are dimmed.
 *
 * Distances are those of reference/spec/apps/system-preferences-mission-control.md, in points
 * from the top-left corner of the window frame.
 */
export function MissionControl() {
  const id = useId();

  return (
    <PaneForm>
      <PaneAt x={23} y={59.5}>
        <MissionControlArtwork />
      </PaneAt>
      <PaneAt x={81} y={60.5}>
        <Label>
          Mission Control gives you an overview of all your open windows, thumbnails of your full-
          <br />
          screen applications, all arranged in a unified view.
        </Label>
      </PaneAt>

      <PaneAt x={SPACES.x} y={SPACES.y}>
        <Box aria-label="Spaces" style={{ width: 628, height: 118 }}>
          <PaneForm origin={SPACES}>
            {OPTIONS.map(([key, y, title, on]) => (
              <Option key={key} id={key} y={y} title={title} on={on} />
            ))}
          </PaneForm>
        </Box>
      </PaneAt>

      <PaneAt x={32} y={248.5}>
        <Label id={`${id}-shortcuts`} textStyle="small">
          Keyboard and Mouse Shortcuts
        </Label>
      </PaneAt>
      <PaneAt x={SHORTCUTS.x} y={SHORTCUTS.y}>
        <Box aria-labelledby={`${id}-shortcuts`} style={{ width: 628, height: 166 }}>
          <PaneForm origin={SHORTCUTS} labelWidth={209} gap={9}>
            <PaneAt x={36.5} y={274}>
              <Label textStyle="small">
                With a single keystroke, view all open windows, windows of the current application,
                or hide windows to locate an
                <br />
                item on the desktop that might be covered up.
              </Label>
            </PaneAt>
            {SHORTCUT_ROWS.map(([key, y, label, keys]) => (
              <Shortcut key={key} id={key} y={y} label={label} keys={keys} />
            ))}
            <PaneAt x={20} y={406} width={628} style={{ justifyContent: "center" }}>
              <Label textStyle="small">
                (for additional choices press Shift, Control, Option, or Command)
              </Label>
            </PaneAt>
          </PaneForm>
        </Box>
      </PaneAt>

      <PaneAt x={20} y={439}>
        {servedByDesktopApp() ? (
          <HotCornersButton style={{ width: 112, paddingInline: 0 }} />
        ) : (
          <Uncaptured action="Hot Corners…">
            <PushButton style={{ width: 112, paddingInline: 0 }}>Hot Corners…</PushButton>
          </Uncaptured>
        )}
      </PaneAt>
      <PaneFooter x={628} y={441}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}
