"use client";

import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { MAILBOXES, type OwnMailbox } from "./mail-data";
import {
  ruleFor,
  SMART_FIELDS,
  type SmartField,
  type SmartRule,
  type SmartTest,
  TESTS_OF,
  valueKind,
} from "./mail-smart";

/** The condition rows of a Smart Mailbox's sheet and of a rule's: field, test, value, − and +. */
export function MailConditionRows({
  rules,
  own,
  onChange,
}: {
  rules: readonly SmartRule[];
  own: readonly OwnMailbox[];
  onChange: (rules: readonly SmartRule[]) => void;
}) {
  const changeRule = (at: number, next: Partial<SmartRule>) =>
    onChange(rules.map((rule, index) => (index === at ? { ...rule, ...next } : rule)));
  return (
    <ul aria-label="Conditions" className="mac-mail-smart-rules">
      {rules.map((rule, index) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: a row holds nothing but its `rule`, which comes from the props
          key={index}
          className="mac-mail-smart-rule"
        >
          <PopUpButton
            aria-label="Field"
            value={rule.field}
            onValueChange={(value) => changeRule(index, ruleFor(value as SmartField))}
          >
            {SMART_FIELDS.map(([field, label]) => (
              <PopUpButtonItem key={field} value={field}>
                {label}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
          <PopUpButton
            aria-label="Test"
            value={rule.test}
            onValueChange={(value) => changeRule(index, { test: value as SmartTest })}
          >
            {TESTS_OF[rule.field].map(([test, label]) => (
              <PopUpButtonItem key={test} value={test}>
                {label}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
          {valueKind(rule.field) === "text" ? (
            <TextField
              aria-label="Value"
              value={rule.value}
              onValueChange={(text) => changeRule(index, { value: text })}
              className="mac-mail-smart-grow"
            />
          ) : null}
          {valueKind(rule.field) === "days" ? (
            <>
              <TextField
                aria-label="Days"
                value={rule.value}
                onValueChange={(text) => changeRule(index, { value: text })}
                className="mac-mail-smart-days"
              />
              <Label>days</Label>
            </>
          ) : null}
          {valueKind(rule.field) === "mailbox" ? (
            <PopUpButton
              aria-label="Mailbox"
              value={rule.value}
              onValueChange={(value) => changeRule(index, { value: String(value) })}
            >
              {[...MAILBOXES, ...own].map(({ id, name: boxName }) => (
                <PopUpButtonItem key={id} value={id}>
                  {boxName}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          ) : null}
          <span className="mac-mail-smart-grow" />
          <PushButton
            aria-label="Remove Condition"
            size="small"
            disabled={rules.length === 1}
            onClick={() => onChange(rules.filter((_, each) => each !== index))}
          >
            −
          </PushButton>
          <PushButton
            aria-label="Add Condition"
            size="small"
            onClick={() =>
              onChange([
                ...rules.slice(0, index + 1),
                ruleFor("subject"),
                ...rules.slice(index + 1),
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
