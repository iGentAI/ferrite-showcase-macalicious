"use client";

import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { TextField } from "macalicious/text-field";
import { useEffect, useId, useState } from "react";
import type { Reminder, ReminderRepeatRule } from "./reminders-data";

const UNITS: readonly { id: ReminderRepeatRule["unit"]; name: string }[] = [
  { id: "day", name: "Days" },
  { id: "week", name: "Weeks" },
  { id: "month", name: "Months" },
  { id: "year", name: "Years" },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** What Custom starts with: every week, on the due day's weekday. */
export const FIRST_RULE: ReminderRepeatRule = { every: 1, unit: "week" };

/**
 * The rows of a custom repeat in the info popover, under "repeat": how often, and for weeks on which
 * days. Each change goes to `onChange` at once; a number that is not 1 to 999 is not taken, and goes
 * back when the field is left.
 */
export function RepeatRuleRows({
  rule,
  due,
  onChange,
}: {
  rule: ReminderRepeatRule;
  /** The reminder's due day, whose weekday a weekly rule falls on until others are chosen. */
  due: string;
  onChange: (change: Partial<Reminder>) => void;
}) {
  const id = useId();
  const [text, setText] = useState(String(rule.every));
  useEffect(() => setText(String(rule.every)), [rule.every]);
  const dueWeekday = new Date(`${due}T00:00:00Z`).getUTCDay();
  const chosen = rule.weekdays ?? [dueWeekday];
  const set = (next: ReminderRepeatRule) => onChange({ repeatRule: next });
  return (
    <>
      <div className="mac-reminders-info-row" data-row="repeat">
        <Label id={`${id}a`} color="secondary" align="end">
          every
        </Label>
        <div className="mac-reminders-info-every">
          <TextField
            aria-labelledby={`${id}a`}
            className="mac-reminders-info-every-number"
            inputMode="numeric"
            value={text}
            onChange={(event) => {
              const typed = event.currentTarget.value;
              setText(typed);
              const every = Number(typed);
              if (/^\d+$/.test(typed) && every >= 1 && every <= 999) set({ ...rule, every });
            }}
            onBlur={() => setText(String(rule.every))}
          />
          <PopUpButton<ReminderRepeatRule["unit"]>
            bordered={false}
            aria-label="Repeat unit"
            value={rule.unit}
            onValueChange={(unit) => {
              if (unit) set({ every: rule.every, unit });
            }}
          >
            {UNITS.map(({ id: unit, name }) => (
              <PopUpButtonItem key={unit} value={unit}>
                {name}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </div>
      </div>
      {rule.unit === "week" ? (
        <div className="mac-reminders-info-row" data-row="repeat">
          <Label color="secondary" align="end">
            on
          </Label>
          <div className="mac-reminders-info-weekdays">
            {WEEKDAYS.map((name, day) => (
              <Checkbox
                key={name}
                aria-label={name}
                checked={chosen.includes(day)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...chosen, day].sort((a, b) => a - b)
                    : chosen.filter((each) => each !== day);
                  if (next.length > 0) set({ ...rule, weekdays: next });
                }}
              >
                {name.slice(0, 1)}
              </Checkbox>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
