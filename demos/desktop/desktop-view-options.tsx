"use client";

import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { Separator } from "macalicious/separator";
import { Slider } from "macalicious/slider";
import { TitleBar } from "macalicious/title-bar";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useState } from "react";
import {
  DESKTOP_GRID_SPACING,
  DESKTOP_ICON_SIZES,
  DESKTOP_TEXT_SIZES,
  type DesktopViewSettings,
} from "./desktop-view-settings";
import "../finder/finder.tokens.css";
import "../finder/finder-view-options.css";

const NO_STACKS = "none";

interface Choice {
  value: string;
  label: string;
}

export interface DesktopViewOptionsProps {
  view: DesktopViewSettings;
  /** How far the window stands from where it opens. */
  at: { x: number; y: number };
  /** The person let the window go there. */
  onMoved: (at: { x: number; y: number }) => void;
  onChange: (change: Partial<DesktopViewSettings>) => void;
  /** How stacks group; `undefined` while the desktop does not use them. */
  stackBy: string | undefined;
  stackChoices: readonly Choice[];
  onStackByChange: (by: string | undefined) => void;
  sortBy: string;
  sortChoices: readonly Choice[];
  onSortByChange: (column: string) => void;
  onClose: () => void;
}

/** The window ⌘J shows on the desktop: how the desktop's icons look and how they are arranged. */
export function DesktopViewOptions({
  view,
  at,
  onMoved,
  onChange,
  stackBy,
  stackChoices,
  onStackByChange,
  sortBy,
  sortChoices,
  onSortByChange,
  onClose,
}: DesktopViewOptionsProps) {
  const [moved, setMoved] = useState({ x: at.x, y: at.y });
  return (
    <Window
      variant="panel"
      state="main"
      className="mac-finder-options mac-desktop-shell-view-options"
      style={{ transform: `translate(${moved.x}px, ${moved.y}px)` }}
      onKeyDown={(event) => {
        if (!matchesMenuKeyEquivalent(event.nativeEvent, "command+j")) return;
        event.preventDefault();
        onClose();
      }}
    >
      <TitleBar
        variant="utility"
        title="Desktop"
        controls={<WindowControls size="small" onClose={onClose} minimizeDisabled zoomDisabled />}
        onDragRegionPointerDown={(down) => {
          const start = { x: down.clientX, y: down.clientY };
          const was = moved;
          let last = moved;
          // The pointer stays on the page, so that the title stays in reach.
          const follow = (move: PointerEvent) => {
            last = {
              x: was.x + Math.min(Math.max(move.clientX, 0), window.innerWidth) - start.x,
              y: was.y + Math.min(Math.max(move.clientY, 0), window.innerHeight) - start.y,
            };
            setMoved(last);
          };
          const end = () => {
            document.removeEventListener("pointermove", follow);
            document.removeEventListener("pointerup", end);
            document.removeEventListener("pointercancel", end);
            onMoved(last);
          };
          document.addEventListener("pointermove", follow);
          document.addEventListener("pointerup", end);
          document.addEventListener("pointercancel", end);
        }}
      />
      <div className="mac-finder-options-body">
        <Label className="mac-finder-options-row">
          <span>Stack By:</span>
          <PopUpButton
            aria-label="Stack By"
            value={stackBy ?? NO_STACKS}
            onValueChange={(value) =>
              onStackByChange(value === NO_STACKS ? undefined : String(value))
            }
          >
            <PopUpButtonItem value={NO_STACKS}>None</PopUpButtonItem>
            {stackChoices.map(({ value, label }) => (
              <PopUpButtonItem key={value} value={value}>
                {label}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </Label>
        <Label className="mac-finder-options-row">
          <span>Sort By:</span>
          <PopUpButton
            aria-label="Sort By"
            value={sortBy}
            onValueChange={(value) => onSortByChange(String(value))}
          >
            {sortChoices.map(({ value, label }) => (
              <PopUpButtonItem key={value} value={value}>
                {label}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </Label>
        <Separator />
        <Label className="mac-finder-options-stack">
          <span>{`Icon size: ${view.icon} × ${view.icon}`}</span>
          <Slider
            aria-label="Icon size"
            size="small"
            {...DESKTOP_ICON_SIZES}
            value={view.icon}
            onValueChange={(value) => onChange({ icon: value as number })}
          />
        </Label>
        <Label className="mac-finder-options-stack">
          <span>Grid spacing:</span>
          <Slider
            aria-label="Grid spacing"
            size="small"
            {...DESKTOP_GRID_SPACING}
            value={view.grid}
            onValueChange={(value) => onChange({ grid: value as number })}
          />
        </Label>
        <Separator />
        <Label className="mac-finder-options-row">
          <span>Text size:</span>
          <PopUpButton
            aria-label="Text size"
            value={String(view.text)}
            onValueChange={(value) => onChange({ text: Number(value) })}
          >
            {DESKTOP_TEXT_SIZES.map((size) => (
              <PopUpButtonItem key={size} value={String(size)}>
                {size}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </Label>
        <RadioGroup
          aria-label="Label position"
          value={view.label}
          className="mac-finder-options-group"
          onValueChange={(value) => onChange({ label: value === "right" ? "right" : "bottom" })}
        >
          <span>Label position:</span>
          <RadioButton value="bottom">Bottom</RadioButton>
          <RadioButton value="right">Right</RadioButton>
        </RadioGroup>
        <Separator />
        <Checkbox checked={view.info} onCheckedChange={(info) => onChange({ info })}>
          Show item info
        </Checkbox>
        <Checkbox checked={view.preview} onCheckedChange={(preview) => onChange({ preview })}>
          Show icon preview
        </Checkbox>
      </div>
    </Window>
  );
}
