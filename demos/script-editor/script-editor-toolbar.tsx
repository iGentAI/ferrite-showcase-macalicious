"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetActions, SheetPopup, SheetTitle } from "macalicious/sheet";

/** The toolbar's items, each of which View > Customize Toolbar… can take out. */
export const SCRIPT_EDITOR_TOOLS = [
  ["record", "Record"],
  ["stop", "Stop"],
  ["run", "Run"],
  ["compile", "Compile"],
  ["panes", "Accessory View and Bundle Contents"],
] as const;

export type ScriptEditorTool = (typeof SCRIPT_EDITOR_TOOLS)[number][0];

export const NO_HIDDEN_TOOLS: readonly ScriptEditorTool[] = [];

/** The items taken out, as stored: anything else is left out. */
export function readHiddenTools(stored: unknown): readonly ScriptEditorTool[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.filter((tool): tool is ScriptEditorTool =>
    SCRIPT_EDITOR_TOOLS.some(([id]) => id === tool),
  );
}

/** View > Customize Toolbar…: a change shows in the toolbar at once, as on a Mac. */
export function ScriptEditorCustomizeToolbar({
  open,
  anchor,
  hidden,
  onChange,
  onDone,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  hidden: readonly ScriptEditorTool[];
  onChange: (hidden: readonly ScriptEditorTool[]) => void;
  onDone: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => next || onDone()}>
      <SheetPopup anchor={anchor} width={340}>
        <SheetTitle>Choose the items the toolbar shows</SheetTitle>
        <div className="mac-script-editor-tool-choices">
          {SCRIPT_EDITOR_TOOLS.map(([tool, label]) => (
            <Checkbox
              key={tool}
              checked={!hidden.includes(tool)}
              onCheckedChange={(shown) =>
                onChange(shown ? hidden.filter((each) => each !== tool) : [...hidden, tool])
              }
            >
              {label}
            </Checkbox>
          ))}
        </div>
        <SheetActions>
          <PushButton onClick={() => onChange([])}>Use Default Set</PushButton>
          <DefaultButton onClick={onDone}>Done</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
