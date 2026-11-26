"use client";

import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { SheetActions, SheetTitle } from "macalicious/sheet";
import { useRef } from "react";

/**
 * What the person keeps in Photos' toolbar and in what order. Back, the zoom slider or the arrows,
 * the views, Edit and the search field stay where a window needs them; what a Mac offers besides
 * these is from memory, since no reference screenshot shows the sheet.
 */
export const PHOTOS_TOOLS = {
  import: "Import",
  info: "Info",
  share: "Share",
  favorite: "Favorite",
  rotate: "Rotate",
  enhance: "Enhance",
  slideshow: "Slideshow",
  delete: "Delete",
  space: "Space",
  flexible: "Flexible Space",
} as const;

export type PhotosTool = keyof typeof PHOTOS_TOOLS;

const ALL_TOOLS = Object.keys(PHOTOS_TOOLS) as PhotosTool[];

export const DEFAULT_TOOLS: readonly PhotosTool[] = [
  "flexible",
  "import",
  "info",
  "share",
  "favorite",
  "rotate",
];

const repeats = (tool: PhotosTool) => tool === "space" || tool === "flexible";

/** Original drawings: no reference screenshot shows these items. */
export function EnhanceGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M2.5 13.5 10 6M11.5 1.5v3M10 3h3M13.5 7v2M12.5 8h2M6 2v2M5 3h2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlayGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M4.5 2.5v11l9-5.5z" fill="none" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

/** The tools in a stored value, each once but for the spaces; anything else is left out. */
export function readTools(stored: unknown): readonly PhotosTool[] | null {
  if (!Array.isArray(stored)) return null;
  const seen = new Set<unknown>();
  return stored.filter((tool): tool is PhotosTool => {
    if (!ALL_TOOLS.includes(tool) || (seen.has(tool) && !repeats(tool))) return false;
    seen.add(tool);
    return true;
  });
}

const moved = (tools: readonly PhotosTool[], from: number, to: number) => {
  const tool = tools[from];
  if (tool === undefined || from === to) return tools;
  const rest = tools.filter((_, at) => at !== from);
  return [...rest.slice(0, to), tool, ...rest.slice(to)];
};

/** View > Customize Toolbar…: a change shows in the toolbar at once, as on a Mac. */
export function CustomizeToolsSheet({
  tools,
  onChange,
  onDone,
}: {
  tools: readonly PhotosTool[];
  onChange: (tools: readonly PhotosTool[]) => void;
  onDone: () => void;
}) {
  const dragged = useRef<number | PhotosTool | null>(null);
  const dropAt = (at: number) => {
    const from = dragged.current;
    dragged.current = null;
    if (typeof from === "number") onChange(moved(tools, from, at));
    else if (from !== null && (!tools.includes(from) || repeats(from))) {
      onChange([...tools.slice(0, at), from, ...tools.slice(at)]);
    }
  };
  return (
    <>
      <SheetTitle>Customize Toolbar</SheetTitle>
      <Label>Drag an item into the toolbar, or click it to add it.</Label>
      <fieldset className="mac-photos-tools" aria-label="Items">
        {ALL_TOOLS.map((tool) => (
          <button
            key={tool}
            type="button"
            draggable
            className="mac-photos-tools-item"
            disabled={tools.includes(tool) && !repeats(tool)}
            onDragStart={() => {
              dragged.current = tool;
            }}
            onClick={() => onChange([...tools, tool])}
          >
            {PHOTOS_TOOLS[tool]}
          </button>
        ))}
      </fieldset>
      <Label textStyle="small">
        In the toolbar: drag to reorder, or use the arrow keys; Delete takes an item out.
      </Label>
      <ul
        aria-label="In the toolbar"
        className="mac-photos-tools mac-photos-tools-now"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          dropAt(tools.length);
        }}
      >
        {tools.map((tool, at) => (
          <li
            // The spaces repeat: each is known by which of them it is.
            key={`${tool}:${tools.slice(0, at).filter((each) => each === tool).length}`}
            draggable
            className="mac-photos-tools-item"
            onDragStart={() => {
              dragged.current = at;
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              dropAt(at);
            }}
          >
            <button
              type="button"
              className="mac-photos-tools-part"
              aria-label={`Move ${PHOTOS_TOOLS[tool]}`}
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
              {PHOTOS_TOOLS[tool]}
            </button>
            <button
              type="button"
              className="mac-photos-tools-part"
              aria-label={`Remove ${PHOTOS_TOOLS[tool]}`}
              onClick={() => onChange(tools.filter((_, index) => index !== at))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <SheetActions>
        <PushButton onClick={() => onChange(DEFAULT_TOOLS)}>Use Default Set</PushButton>
        <DefaultButton onClick={onDone}>Done</DefaultButton>
      </SheetActions>
    </>
  );
}
