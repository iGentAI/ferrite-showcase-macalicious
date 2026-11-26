"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { useRef, useState } from "react";
import type { SmartPlaylist, SmartRule } from "./music-server";
import { ruleProblem, SMART_FIELDS, SMART_OPS, type SmartField, smartKind } from "./music-smart";

const MAX_RULES = 20;
const MAX_LIMIT = 500;

export const NEW_SMART: SmartPlaylist = {
  all: true,
  rules: [{ field: "artist", op: "contains", value: "" }],
};

type Row = SmartRule & { key: number };

/** The rules of a smart playlist: match all or any of them, and how many songs it keeps. */
export function MusicSmartEditor({
  initial,
  anchor,
  onSave,
  onCancel,
}: {
  initial: SmartPlaylist;
  anchor: Element | null;
  onSave: (smart: SmartPlaylist) => void;
  onCancel: () => void;
}) {
  const nextKey = useRef(initial.rules.length);
  const [all, setAll] = useState(initial.all);
  const [rows, setRows] = useState<Row[]>(initial.rules.map((rule, key) => ({ ...rule, key })));
  const [limited, setLimited] = useState(Boolean(initial.limit));
  const [limit, setLimit] = useState(String(initial.limit ?? 25));
  const [problem, setProblem] = useState<string | null>(null);

  const change = (key: number, part: Partial<SmartRule>) => {
    setProblem(null);
    setRows((now) => now.map((row) => (row.key === key ? { ...row, ...part } : row)));
  };

  const save = () => {
    const rules = rows.map(({ field, op, value }) => ({ field, op, value: value.trim() }));
    const wrong = rules.map(ruleProblem).find(Boolean);
    if (wrong) {
      setProblem(wrong);
      return;
    }
    const count = Number(limit);
    if (limited && !(Number.isInteger(count) && count > 0 && count <= MAX_LIMIT)) {
      setProblem(`Limit to a whole number of songs up to ${MAX_LIMIT}.`);
      return;
    }
    onSave({ all, rules, ...(limited ? { limit: count } : {}) });
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <SheetPopup anchor={anchor} width={620} aria-label="Smart Playlist">
        <form
          className="mac-music-smart"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <SheetTitle>Smart Playlist</SheetTitle>
          <div className="mac-music-smart-row">
            <span>Match</span>
            <PopUpButton<string>
              aria-label="Match"
              value={all ? "all" : "any"}
              onValueChange={(next) => setAll(next === "all")}
            >
              <PopUpButtonItem value="all">all</PopUpButtonItem>
              <PopUpButtonItem value="any">any</PopUpButtonItem>
            </PopUpButton>
            <span>of the following rules:</span>
          </div>
          {rows.map((row, index) => {
            const kind = smartKind(row.field);
            return (
              <fieldset
                key={row.key}
                className="mac-music-smart-row"
                aria-label={`Rule ${index + 1}`}
              >
                <PopUpButton<SmartField>
                  aria-label="Field"
                  value={row.field}
                  onValueChange={(next) => {
                    if (!next || next === row.field) return;
                    const same = smartKind(next) === kind;
                    change(row.key, {
                      field: next,
                      op: same ? row.op : (SMART_OPS[smartKind(next)][0]?.op ?? "is"),
                      value: same ? row.value : "",
                    });
                  }}
                >
                  {SMART_FIELDS.map(({ field, label }) => (
                    <PopUpButtonItem key={field} value={field}>
                      {label}
                    </PopUpButtonItem>
                  ))}
                </PopUpButton>
                <PopUpButton<SmartRule["op"]>
                  aria-label="Condition"
                  value={row.op}
                  onValueChange={(next) => {
                    if (next) change(row.key, { op: next });
                  }}
                >
                  {SMART_OPS[kind].map(({ op, label }) => (
                    <PopUpButtonItem key={op} value={op}>
                      {label}
                    </PopUpButtonItem>
                  ))}
                </PopUpButton>
                {kind === "flag" ? null : (
                  <TextField
                    aria-label="Value"
                    value={row.value}
                    onValueChange={(value) => change(row.key, { value })}
                  />
                )}
                <PushButton
                  aria-label="Remove Rule"
                  disabled={rows.length === 1}
                  onClick={() => setRows((now) => now.filter((other) => other.key !== row.key))}
                >
                  −
                </PushButton>
                <PushButton
                  aria-label="Add Rule"
                  disabled={rows.length >= MAX_RULES}
                  onClick={() => {
                    nextKey.current += 1;
                    const added = {
                      key: nextKey.current,
                      field: "artist" as const,
                      op: "contains" as const,
                      value: "",
                    };
                    setRows((now) => [...now.slice(0, index + 1), added, ...now.slice(index + 1)]);
                  }}
                >
                  +
                </PushButton>
              </fieldset>
            );
          })}
          <div className="mac-music-smart-row">
            <Checkbox checked={limited} onCheckedChange={setLimited}>
              Limit to
            </Checkbox>
            <TextField
              aria-label="Limit"
              disabled={!limited}
              style={{ width: 60 }}
              value={limit}
              onValueChange={setLimit}
            />
            <span>songs, the most recently added</span>
          </div>
          {problem ? <p role="alert">{problem}</p> : null}
          <SheetActions>
            <SheetClose render={<PushButton />}>Cancel</SheetClose>
            <DefaultButton type="submit">OK</DefaultButton>
          </SheetActions>
        </form>
      </SheetPopup>
    </Sheet>
  );
}
