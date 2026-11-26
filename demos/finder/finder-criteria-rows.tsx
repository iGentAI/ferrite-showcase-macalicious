"use client";

import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { ScopeBar, ScopeBarAction, ScopeBarActions } from "macalicious/scope-bar";
import { TextField } from "macalicious/text-field";
import {
  CRITERION_FIELDS,
  CRITERION_KINDS,
  CRITERION_UNITS,
  type CriterionField,
  type CriterionUnit,
  criterionInput,
  criterionOps,
  type FinderCriterion,
  newCriterion,
} from "./finder-criteria";

/** One row under the scope bar: an attribute, how it compares and to what, a minus and a plus. */
export function FinderCriterionRow({
  row,
  contentsOffered,
  onChange,
  onRemove,
  onAdd,
}: {
  row: FinderCriterion;
  /** Whether the attribute list offers Contents: on the person's drive, the only files with words
   * to search, and to one row of a search. */
  contentsOffered: boolean;
  onChange: (row: FinderCriterion) => void;
  onRemove: () => void;
  onAdd: () => void;
}) {
  const input = criterionInput(row);
  const value = (
    label: string,
    type: "text" | "number" | "date",
    className = "mac-finder-criterion-text",
  ) => (
    <TextField
      aria-label={label}
      className={className}
      size="small"
      type={type}
      value={row.value}
      onValueChange={(text: string) => onChange({ ...row, value: text })}
    />
  );
  return (
    <ScopeBar className="mac-finder-criterion">
      <PopUpButton
        aria-label="Search attribute"
        size="small"
        value={row.field}
        onValueChange={(field) => onChange(newCriterion(field as CriterionField))}
      >
        {CRITERION_FIELDS.filter((field) => contentsOffered || field.id !== "contents").map(
          (field) => (
            <PopUpButtonItem key={field.id} value={field.id}>
              {field.label}
            </PopUpButtonItem>
          ),
        )}
      </PopUpButton>
      <PopUpButton
        aria-label="Comparison"
        size="small"
        value={row.op}
        onValueChange={(op) => {
          const next = { ...row, op: op as string };
          const changed = criterionInput(next) !== input;
          onChange(changed ? { ...next, value: criterionInput(next) === "days" ? "7" : "" } : next);
        }}
      >
        {criterionOps(row).map((op) => (
          <PopUpButtonItem key={op.id} value={op.id}>
            {op.label}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
      {input === "kind" && (
        <PopUpButton
          aria-label="Kind"
          size="small"
          value={row.value}
          onValueChange={(kind) => onChange({ ...row, value: kind as string })}
        >
          {CRITERION_KINDS.map((kind) => (
            <PopUpButtonItem key={kind.id} value={kind.id}>
              {kind.label}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      )}
      {input === "text" && value("Search for", "text")}
      {input === "date" && value("Date", "date", "mac-finder-criterion-date")}
      {input === "days" && (
        <>
          {value("Days", "number", "mac-finder-criterion-number")}
          <span>days</span>
        </>
      )}
      {input === "size" && (
        <>
          {value("Size", "number", "mac-finder-criterion-number")}
          <PopUpButton
            aria-label="Unit"
            size="small"
            value={row.unit ?? "KB"}
            onValueChange={(unit) => onChange({ ...row, unit: unit as CriterionUnit })}
          >
            {CRITERION_UNITS.map((unit) => (
              <PopUpButtonItem key={unit} value={unit}>
                {unit}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </>
      )}
      <ScopeBarActions>
        <ScopeBarAction glyph="minus" aria-label="Remove search criterion" onClick={onRemove} />
        <ScopeBarAction glyph="plus" aria-label="Add search criterion" onClick={onAdd} />
      </ScopeBarActions>
    </ScopeBar>
  );
}
