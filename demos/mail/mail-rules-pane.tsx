"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { useState } from "react";
import type { OwnMailbox } from "./mail-data";
import { MailRuleSheet, NEW_RULE, type RuleDraft, ruleSummary } from "./mail-rule-sheet";
import { type MailRule, rulesFit } from "./mail-rules";

/**
 * Preferences > Rules: the list, each rule with its On checkbox, and Add Rule, Edit, Duplicate and
 * Remove. `onAdded` is told when a rule has been added or changed, as Mail then asks whether to run
 * the rules on what the mailbox holds.
 */
export function MailRulesPane({
  rules,
  own,
  anchor,
  onChange,
  onAdded,
}: {
  rules: readonly MailRule[];
  own: readonly OwnMailbox[];
  /** What the sheet hangs from: the window's toolbar. */
  anchor: HTMLElement | null;
  onChange: (rules: readonly MailRule[]) => void;
  onAdded: () => void;
}) {
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const [editing, setEditing] = useState<RuleDraft | null>(null);
  const [full, setFull] = useState(false);
  const current = rules.find((rule) => rule.id === chosen[0]) ?? null;
  // Whether the list could be kept: one too long for the person's settings is not kept at all.
  const keep = (next: readonly MailRule[]) => {
    const fits = rulesFit(next);
    setFull(!fits);
    if (fits) onChange(next);
    return fits;
  };
  const save = (draft: RuleDraft) => {
    const { id } = draft;
    if (id) {
      if (keep(rules.map((rule) => (rule.id === id ? { ...draft, id } : rule)))) onAdded();
      return;
    }
    const made: MailRule = { ...draft, id: `rule-${crypto.randomUUID()}` };
    if (keep([...rules, made])) {
      setChosen([made.id]);
      onAdded();
    }
  };
  return (
    <div className="mac-mail-rules">
      <BorderedList className="mac-mail-rules-list">
        <BorderedListRows
          aria-label="Rules"
          rowHeight={34}
          value={chosen}
          onValueChange={setChosen}
          onRowAction={(id) => setEditing(rules.find((rule) => rule.id === id) ?? null)}
        >
          {rules.map((rule) => (
            <BorderedListRow
              key={rule.id}
              value={rule.id}
              title={rule.description}
              subtitle={ruleSummary(rule, own)}
              textValue={rule.description}
              leading={
                <Checkbox
                  aria-label={`Active: ${rule.description}`}
                  checked={rule.enabled}
                  onCheckedChange={(checked) =>
                    keep(
                      rules.map((each) =>
                        each.id === rule.id ? { ...each, enabled: checked === true } : each,
                      ),
                    )
                  }
                />
              }
            />
          ))}
        </BorderedListRows>
      </BorderedList>
      <div className="mac-mail-rules-buttons">
        <PushButton onClick={() => setEditing(NEW_RULE)}>Add Rule</PushButton>
        <PushButton disabled={!current} onClick={() => setEditing(current)}>
          Edit
        </PushButton>
        <PushButton
          disabled={!current}
          onClick={() => {
            if (!current) return;
            const made = {
              ...current,
              id: `rule-${crypto.randomUUID()}`,
              description: `${current.description} Copy`,
            };
            const after = rules.indexOf(current) + 1;
            if (keep([...rules.slice(0, after), made, ...rules.slice(after)])) {
              setChosen([made.id]);
            }
          }}
        >
          Duplicate
        </PushButton>
        <PushButton
          disabled={!current}
          onClick={() => {
            keep(rules.filter((rule) => rule.id !== current?.id));
            setChosen([]);
          }}
        >
          Remove
        </PushButton>
      </div>
      {full ? (
        <Label role="alert" className="mac-mail-rules-note">
          That rule was not kept: the rules are too long to save. Remove one first.
        </Label>
      ) : null}
      <MailRuleSheet
        asking={editing}
        own={own}
        anchor={anchor}
        onSave={save}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
