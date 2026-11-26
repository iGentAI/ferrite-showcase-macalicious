"use client";

import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetActions, SheetPopup, SheetTitle } from "macalicious/sheet";
import { keptListReader } from "./font-book-data";

/**
 * What the person keeps in Font Book's toolbar and in what order. What a Mac offers besides the
 * default set is from memory: no reference screenshot shows this sheet.
 */
export const FONT_TOOLS = {
  views: "Preview",
  add: "Add Fonts",
  enable: "Disable",
  search: "Search",
  print: "Print",
  validate: "Validate Font",
  fixed: "Space",
  flexible: "Flexible Space",
} as const;

export type FontTool = keyof typeof FONT_TOOLS;

const ALL_TOOLS = Object.keys(FONT_TOOLS) as FontTool[];

export const DEFAULT_FONT_TOOLS: readonly FontTool[] = [
  "views",
  "fixed",
  "add",
  "enable",
  "flexible",
  "search",
];

const repeats = (tool: FontTool) => tool === "fixed" || tool === "flexible";

/** The tools in a stored value, each once but for the spaces; anything else is left out. */
export const readFontTools = keptListReader<FontTool>((stored) => {
  const seen = new Set<unknown>();
  return stored.filter((tool): tool is FontTool => {
    if (!ALL_TOOLS.includes(tool as FontTool) || (seen.has(tool) && !repeats(tool as FontTool))) {
      return false;
    }
    seen.add(tool);
    return true;
  });
});

const moved = (tools: readonly FontTool[], from: number, to: number) => {
  const tool = tools[from];
  if (tool === undefined) return tools;
  const rest = tools.filter((_, at) => at !== from);
  return [...rest.slice(0, to), tool, ...rest.slice(to)];
};

/** View > Customize Toolbar…: a change shows in the toolbar at once, as on a Mac. */
export function FontToolsSheet({
  open,
  anchor,
  tools,
  onChange,
  onClose,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  tools: readonly FontTool[];
  onChange: (tools: readonly FontTool[]) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={460}>
        <SheetTitle>Customize Toolbar</SheetTitle>
        <Label>Click an item to add it to the toolbar.</Label>
        <fieldset className="mac-font-book-tools" aria-label="Items">
          {ALL_TOOLS.map((tool) => (
            <button
              key={tool}
              type="button"
              className="mac-font-book-tools-item"
              disabled={tools.includes(tool) && !repeats(tool)}
              onClick={() => onChange([...tools, tool])}
            >
              {FONT_TOOLS[tool]}
            </button>
          ))}
        </fieldset>
        <Label textStyle="small">
          In the toolbar: the arrow keys move an item, and Delete takes it out.
        </Label>
        <ul aria-label="In the toolbar" className="mac-font-book-tools">
          {tools.map((tool, at) => (
            <li
              // The spaces repeat: each is known by which of them it is.
              key={`${tool}:${tools.slice(0, at).filter((each) => each === tool).length}`}
              className="mac-font-book-tools-item"
            >
              <button
                type="button"
                className="mac-font-book-tools-part"
                aria-label={`Move ${FONT_TOOLS[tool]}`}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" && at > 0) onChange(moved(tools, at, at - 1));
                  else if (event.key === "ArrowRight" && at < tools.length - 1) {
                    onChange(moved(tools, at, at + 1));
                  } else if (event.key === "Delete" || event.key === "Backspace") {
                    onChange(tools.filter((_, index) => index !== at));
                  } else return;
                  event.preventDefault();
                }}
              >
                {FONT_TOOLS[tool]}
              </button>
              <button
                type="button"
                className="mac-font-book-tools-part"
                aria-label={`Remove ${FONT_TOOLS[tool]}`}
                onClick={() => onChange(tools.filter((_, index) => index !== at))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <SheetActions>
          <PushButton onClick={() => onChange(DEFAULT_FONT_TOOLS)}>Use Default Set</PushButton>
          <DefaultButton onClick={onClose}>Done</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
