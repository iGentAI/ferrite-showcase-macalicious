"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetActions, SheetPopup, SheetTitle } from "macalicious/sheet";

/** The toolbar's items a person can take out. */
export const PREVIEW_TOOLS = [
  ["view", "View"],
  ["zoom", "Zoom"],
  ["open", "Open"],
  ["file", "Share"],
  ["highlight", "Highlight"],
  ["rotate", "Rotate"],
  ["markup", "Show Markup Toolbar"],
  ["inspector", "Show Inspector"],
  ["search", "Search"],
] as const;

export type PreviewToolbarItem = (typeof PREVIEW_TOOLS)[number][0];

const NO_TOOLS: readonly PreviewToolbarItem[] = [];

/** The items taken out of the toolbar, as stored: anything Preview did not write is left out. */
export function readHiddenTools(stored: unknown): readonly PreviewToolbarItem[] {
  if (!Array.isArray(stored)) return NO_TOOLS;
  return stored.filter((tool): tool is PreviewToolbarItem =>
    PREVIEW_TOOLS.some(([id]) => id === tool),
  );
}

/** View > Customize Toolbar…: a change shows in the toolbar at once, as on a Mac. */
export function PreviewCustomizeToolbar({
  open,
  anchor,
  hidden,
  onChange,
  onDone,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  hidden: readonly PreviewToolbarItem[];
  onChange: (hidden: readonly PreviewToolbarItem[]) => void;
  onDone: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => next || onDone()}>
      <SheetPopup anchor={anchor} width={320} aria-label="Customize Toolbar">
        <SheetTitle>Choose the items the toolbar shows</SheetTitle>
        {PREVIEW_TOOLS.map(([tool, label]) => (
          <Checkbox
            key={tool}
            className="mac-preview-app-tool-choice"
            checked={!hidden.includes(tool)}
            onCheckedChange={(shown) =>
              onChange(shown ? hidden.filter((each) => each !== tool) : [...hidden, tool])
            }
          >
            {label}
          </Checkbox>
        ))}
        <SheetActions>
          <PushButton onClick={() => onChange(NO_TOOLS)}>Use Default Set</PushButton>
          <DefaultButton onClick={onDone}>Done</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
