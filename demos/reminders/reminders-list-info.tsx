"use client";

import { Label } from "macalicious/label";
import { Popover, PopoverPopup, PopoverTitle } from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { type CSSProperties, type FormEvent, useId, useState } from "react";
import { LIST_COLORS, type ReminderColor, type ReminderList } from "./reminders-data";

/** As captured for the info popover: the opaque material. */
const POPUP_OPAQUE = {
  "--mac-material-popover": "var(--mac-material-popover-opaque)",
} as CSSProperties;

/** The longest name the server keeps for a list (`MAX_NAME_CHARS`, src/apps/reminders/mod.rs). */
export const MAX_LIST_NAME = 100;

const COLOR_NAMES: Readonly<Record<ReminderColor, string>> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  brown: "Brown",
  gray: "Gray",
};

/** Why `name` cannot name a list, or `null` when it can: the server's rule, said in the window. */
export function listNameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "A list needs a name.";
  if ([...trimmed].length > MAX_LIST_NAME) {
    return `A list's name has at most ${MAX_LIST_NAME} characters.`;
  }
  return null;
}

export interface ReminderListInfoProps {
  /** The list as it is. */
  list: ReminderList;
  /** What the popover's arrow points at: the list's row. */
  anchor: Element | null;
  /**
   * The popover's surface, as on the info popover.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /** Called with the list's new name (trimmed) and colour when OK is pressed. */
  onSave: (change: { name: string; color: ReminderColor }) => void;
  /** Called when the popover goes: OK, Cancel, Escape or a press outside it. */
  onClose: () => void;
}

/**
 * A list's Info, as Show Info in a list's contextual menu opens it in Reminders: the list's
 * name and colour. OK (or Return) changes them; Cancel, Escape or a press outside leaves the
 * list as it was. A name that is empty or longer than the server keeps is refused here, so OK
 * is unavailable and the popover says why. Open while rendered.
 */
export function ReminderListInfo({
  list,
  anchor,
  material = "translucent",
  onSave,
  onClose,
}: ReminderListInfoProps) {
  const id = useId();
  const [name, setName] = useState(list.name);
  const [color, setColor] = useState<ReminderColor>(list.color);
  const problem = listNameProblem(name);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (problem !== null) return;
    onSave({ name: name.trim(), color });
    onClose();
  };
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverPopup
        side="right"
        anchor={anchor}
        className="mac-reminders-list-info"
        style={material === "opaque" ? POPUP_OPAQUE : undefined}
      >
        <PopoverTitle className="mac-reminders-share-title">List Info</PopoverTitle>
        <form className="mac-reminders-list-info-form" onSubmit={submit}>
          <Label id={`${id}n`} color="secondary">
            Name:
          </Label>
          <TextField
            aria-labelledby={`${id}n`}
            autoComplete="off"
            autoFocus
            value={name}
            onValueChange={setName}
          />
          <Label id={`${id}c`} color="secondary">
            Color:
          </Label>
          <fieldset aria-labelledby={`${id}c`} className="mac-reminders-swatches">
            {LIST_COLORS.map((each) => (
              <button
                key={each}
                type="button"
                className="mac-reminders-swatch"
                data-color={each}
                aria-label={COLOR_NAMES[each]}
                aria-pressed={color === each}
                onClick={() => setColor(each)}
              />
            ))}
          </fieldset>
          {problem !== null ? (
            <p role="alert" className="mac-reminders-share-error mac-reminders-list-info-wide">
              {problem}
            </p>
          ) : null}
          <div className="mac-reminders-list-info-buttons mac-reminders-list-info-wide">
            <PushButton onClick={onClose}>Cancel</PushButton>
            <PushButton type="submit" variant="primary" disabled={problem !== null}>
              OK
            </PushButton>
          </div>
        </form>
      </PopoverPopup>
    </Popover>
  );
}
