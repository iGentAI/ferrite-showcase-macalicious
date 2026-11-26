"use client";

import { PopUpButton, PopUpButtonItem, type PopUpButtonProps } from "macalicious/pop-up-button";
import { usePreference } from "./pane";

export interface PaneChoiceProps
  extends Omit<PopUpButtonProps<string>, "value" | "defaultValue" | "onValueChange" | "children"> {
  /** Key of the setting that holds the choice: `usePreference`'s, prefixed with the pane's id. */
  setting: string;
  /** The titles of the menu's items, which are also their values. */
  options: readonly string[];
  /** The title chosen at first: the one the capture shows. */
  initial: string;
  /**
   * Width of the button's box in points: the bezel a blueprint measures, plus the half point
   * the box keeps around it on each side.
   */
  width: number;
}

/**
 * A pop-up button of a pane whose choice is a setting of the window: the library's
 * `PopUpButton` with one item per title, kept with `usePreference` so the choice survives
 * leaving the pane. It has no label of its own: name it with `aria-label` or `aria-labelledby`.
 */
export function PaneChoice({ setting, options, initial, width, style, ...props }: PaneChoiceProps) {
  const [value, setValue] = usePreference(setting, initial);
  return (
    <PopUpButton
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") setValue(next);
      }}
      style={{ width, ...style }}
      {...props}
    >
      {options.map((title) => (
        <PopUpButtonItem key={title} value={title}>
          {title}
        </PopUpButtonItem>
      ))}
    </PopUpButton>
  );
}
