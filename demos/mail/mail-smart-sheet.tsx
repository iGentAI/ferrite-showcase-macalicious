"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { useState } from "react";
import { MailConditionRows } from "./mail-conditions";
import type { OwnMailbox } from "./mail-data";
import { ruleComplete, ruleFor, type SmartMailbox } from "./mail-smart";

/** What the sheet is asked to edit: `id` is absent for a new Smart Mailbox. */
export type SmartDraft = Omit<SmartMailbox, "id"> & Partial<Pick<SmartMailbox, "id">>;

/** A Smart Mailbox not made yet: one empty condition, as Mail's sheet starts. */
export const NEW_SMART: SmartDraft = {
  name: "",
  matchAll: false,
  rules: [ruleFor("from")],
  includeTrash: false,
  includeSent: false,
};

function SmartForm({
  first,
  own,
  anchor,
  refusal,
  onSave,
}: {
  first: SmartDraft;
  own: readonly OwnMailbox[];
  anchor: HTMLElement | null;
  refusal: (name: string) => string | null;
  onSave: (draft: SmartDraft) => void;
}) {
  const [draft, setDraft] = useState(first);
  const change = (next: Partial<SmartDraft>) => setDraft((now) => ({ ...now, ...next }));
  const name = draft.name.trim();
  const taken = name ? refusal(name) : null;
  const ready = name !== "" && !taken && draft.rules.every(ruleComplete);
  return (
    <SheetPopup anchor={anchor} width={640}>
      <SheetTitle>{first.id ? "Edit Smart Mailbox" : "New Smart Mailbox"}</SheetTitle>
      <div className="mac-mail-smart">
        <div className="mac-mail-smart-line">
          <Label>Smart Mailbox Name:</Label>
          <TextField
            aria-label="Smart Mailbox Name"
            value={draft.name}
            onValueChange={(text) => change({ name: text })}
            className="mac-mail-smart-grow"
          />
        </div>
        {taken ? (
          <div role="alert" className="mac-mail-smart-refusal">
            {taken}
          </div>
        ) : null}
        <div className="mac-mail-smart-line">
          <Label>Contains messages that match</Label>
          <PopUpButton
            aria-label="Match"
            value={draft.matchAll ? "all" : "any"}
            onValueChange={(value) => change({ matchAll: value === "all" })}
          >
            <PopUpButtonItem value="any">any</PopUpButtonItem>
            <PopUpButtonItem value="all">all</PopUpButtonItem>
          </PopUpButton>
          <Label>of the following conditions:</Label>
        </div>
        <MailConditionRows rules={draft.rules} own={own} onChange={(rules) => change({ rules })} />
        <Checkbox
          checked={draft.includeTrash}
          onCheckedChange={(checked) => change({ includeTrash: checked === true })}
        >
          Include messages from Trash
        </Checkbox>
        <Checkbox
          checked={draft.includeSent}
          onCheckedChange={(checked) => change({ includeSent: checked === true })}
        >
          Include messages from Sent
        </Checkbox>
      </div>
      <SheetActions>
        <SheetClose>Cancel</SheetClose>
        <SheetClose
          render={<DefaultButton />}
          disabled={!ready}
          onClick={() => onSave({ ...draft, name })}
        >
          OK
        </SheetClose>
      </SheetActions>
    </SheetPopup>
  );
}

/** The sheet of New Smart Mailbox and Edit Smart Mailbox. */
export function MailSmartSheet({
  asking,
  own,
  anchor,
  refusal,
  onSave,
  onClose,
}: {
  /** What is being edited: `null` keeps the sheet closed. */
  asking: SmartDraft | null;
  own: readonly OwnMailbox[];
  anchor: HTMLElement | null;
  /** Why a name cannot be taken, or `null` when it can. */
  refusal: (name: string) => string | null;
  onSave: (draft: SmartDraft) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={asking !== null} onOpenChange={(open) => !open && onClose()}>
      {asking ? (
        <SmartForm first={asking} own={own} anchor={anchor} refusal={refusal} onSave={onSave} />
      ) : null}
    </Sheet>
  );
}
