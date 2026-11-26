"use client";

import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import { TagDot } from "macalicious/tag-dot";
import { TextField } from "macalicious/text-field";
import { useState } from "react";
import { MailConditionRows } from "./mail-conditions";
import {
  FLAGS,
  MAILBOXES,
  type MailboxId,
  type MailFlag,
  mailboxName,
  type OwnMailbox,
} from "./mail-data";
import { actionFor, type MailRule, type MailRuleAction, RULE_ACTIONS } from "./mail-rules";
import { ruleComplete, ruleFor } from "./mail-smart";

/** What the sheet is asked to edit: `id` is absent for a new rule. */
export type RuleDraft = Omit<MailRule, "id"> & Partial<Pick<MailRule, "id">>;

/** A rule not made yet: one empty condition and one action, as Mail's sheet starts. */
export const NEW_RULE: RuleDraft = {
  description: "",
  enabled: true,
  matchAll: false,
  conditions: [ruleFor("from")],
  actions: [actionFor("move")],
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function ActionRows({
  actions,
  own,
  onChange,
}: {
  actions: readonly MailRuleAction[];
  own: readonly OwnMailbox[];
  onChange: (actions: readonly MailRuleAction[]) => void;
}) {
  const put = (at: number, next: MailRuleAction) =>
    onChange(actions.map((action, index) => (index === at ? next : action)));
  // Only a draft the person saves is kept in Drafts: no rule moves mail there.
  const boxes = [...MAILBOXES, ...own].filter(({ id }) => id !== "drafts");
  return (
    <ul aria-label="Actions" className="mac-mail-smart-rules">
      {actions.map((action, index) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: a row holds nothing but its `action`, which comes from the props
          key={index}
          className="mac-mail-smart-rule"
        >
          <PopUpButton
            aria-label="Action"
            value={action.kind}
            onValueChange={(value) => put(index, actionFor(value as MailRuleAction["kind"]))}
          >
            {RULE_ACTIONS.map(([kind, label]) => (
              <PopUpButtonItem key={kind} value={kind}>
                {label}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
          {action.kind === "move" ? (
            <>
              <Label>to mailbox:</Label>
              <PopUpButton
                aria-label="To Mailbox"
                value={action.mailbox}
                onValueChange={(value) => put(index, { kind: "move", mailbox: value as MailboxId })}
              >
                {boxes.map(({ id, name }) => (
                  <PopUpButtonItem key={id} value={id}>
                    {name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </>
          ) : null}
          {action.kind === "flag" ? (
            <PopUpButton
              aria-label="Flag Color"
              value={action.flag}
              onValueChange={(value) => put(index, { kind: "flag", flag: value as MailFlag })}
            >
              {FLAGS.map((flag) => (
                <PopUpButtonItem key={flag} value={flag} image={<TagDot color={flag} />}>
                  {capitalize(flag)}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          ) : null}
          <span className="mac-mail-smart-grow" />
          <PushButton
            aria-label="Remove Action"
            size="small"
            disabled={actions.length === 1}
            onClick={() => onChange(actions.filter((_, each) => each !== index))}
          >
            −
          </PushButton>
          <PushButton
            aria-label="Add Action"
            size="small"
            onClick={() =>
              onChange([
                ...actions.slice(0, index + 1),
                actionFor("read"),
                ...actions.slice(index + 1),
              ])
            }
          >
            +
          </PushButton>
        </li>
      ))}
    </ul>
  );
}

function RuleForm({
  first,
  own,
  anchor,
  onSave,
}: {
  first: RuleDraft;
  own: readonly OwnMailbox[];
  anchor: HTMLElement | null;
  onSave: (draft: RuleDraft) => void;
}) {
  const [draft, setDraft] = useState(first);
  const change = (next: Partial<RuleDraft>) => setDraft((now) => ({ ...now, ...next }));
  const description = draft.description.trim();
  const ready = description !== "" && draft.conditions.every(ruleComplete);
  return (
    <SheetPopup anchor={anchor} width={640}>
      <SheetTitle>{first.id ? "Edit Rule" : "Add Rule"}</SheetTitle>
      <div className="mac-mail-smart">
        <div className="mac-mail-smart-line">
          <Label>Description:</Label>
          <TextField
            aria-label="Description"
            value={draft.description}
            onValueChange={(text) => change({ description: text })}
            className="mac-mail-smart-grow"
          />
        </div>
        <div className="mac-mail-smart-line">
          <Label>If</Label>
          <PopUpButton
            aria-label="Match"
            value={draft.matchAll ? "all" : "any"}
            onValueChange={(value) => change({ matchAll: value === "all" })}
          >
            <PopUpButtonItem value="any">any</PopUpButtonItem>
            <PopUpButtonItem value="all">all</PopUpButtonItem>
          </PopUpButton>
          <Label>of the following conditions are met:</Label>
        </div>
        <MailConditionRows
          rules={draft.conditions}
          own={own}
          onChange={(conditions) => change({ conditions })}
        />
        <Label>Perform the following actions:</Label>
        <ActionRows actions={draft.actions} own={own} onChange={(actions) => change({ actions })} />
      </div>
      <SheetActions>
        <SheetClose>Cancel</SheetClose>
        <SheetClose
          render={<DefaultButton />}
          disabled={!ready}
          onClick={() => onSave({ ...draft, description })}
        >
          OK
        </SheetClose>
      </SheetActions>
    </SheetPopup>
  );
}

/** The sheet of Add Rule and Edit. */
export function MailRuleSheet({
  asking,
  own,
  anchor,
  onSave,
  onClose,
}: {
  /** What is being edited: `null` keeps the sheet closed. */
  asking: RuleDraft | null;
  own: readonly OwnMailbox[];
  anchor: HTMLElement | null;
  onSave: (draft: RuleDraft) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={asking !== null} onOpenChange={(open) => !open && onClose()}>
      {asking ? <RuleForm first={asking} own={own} anchor={anchor} onSave={onSave} /> : null}
    </Sheet>
  );
}

/** How the list says what a rule does, in a line. */
export function ruleSummary(rule: MailRule, own: readonly OwnMailbox[]): string {
  return rule.actions
    .map((action) => {
      if (action.kind === "move") return `Move to ${mailboxName(action.mailbox, own)}`;
      if (action.kind === "flag") return `Flag ${capitalize(action.flag)}`;
      return action.kind === "read" ? "Mark as Read" : "Delete";
    })
    .join(", ");
}
