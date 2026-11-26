"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetActions, SheetPopup, SheetTitle } from "macalicious/sheet";

/** The viewer's toolbar items a person can take out; the search field stays. */
export const MAIL_TOOLS = [
  ["getMail", "Get Mail"],
  ["newMessage", "New Message"],
  ["archive", "Archive"],
  ["remove", "Delete/Junk"],
  ["respond", "Reply/Reply All/Forward"],
  ["flag", "Flag"],
  ["mute", "Mute"],
  ["move", "Move to…"],
] as const;

export type MailToolbarItem = (typeof MAIL_TOOLS)[number][0];

/** The items taken out of the toolbar, as stored: anything Mail did not write is left out. */
export function readHiddenTools(stored: unknown): readonly MailToolbarItem[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter((tool): tool is MailToolbarItem => MAIL_TOOLS.some(([id]) => id === tool));
}

/** View > Customize Toolbar…: a change shows in the toolbar at once, as on a Mac. */
export function MailCustomizeToolbar({
  open,
  anchor,
  hidden,
  onChange,
  onDone,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  hidden: readonly MailToolbarItem[];
  onChange: (hidden: readonly MailToolbarItem[]) => void;
  onDone: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => next || onDone()}>
      <SheetPopup anchor={anchor} width={320}>
        <SheetTitle>Choose the items the toolbar shows</SheetTitle>
        {MAIL_TOOLS.map(([tool, label]) => (
          <Checkbox
            key={tool}
            className="mac-mail-tool-choice"
            checked={!hidden.includes(tool)}
            onCheckedChange={(shown) =>
              onChange(shown ? hidden.filter((each) => each !== tool) : [...hidden, tool])
            }
          >
            {label}
          </Checkbox>
        ))}
        <SheetActions>
          <PushButton onClick={() => onChange([])}>Use Default Set</PushButton>
          <DefaultButton onClick={onDone}>Done</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
