"use client";

import { CRITERION_KINDS, type FinderCriterion } from "./finder-criteria";
import { TAGS } from "./finder-data";

/** One row offered under the search field while words are typed: picked, it becomes a criterion. */
export interface SearchSuggestion {
  /** The heading it stands under. */
  group: "Filenames" | "Kinds" | "Tags";
  label: string;
  criterion: FinderCriterion;
}

/** What the words typed could mean, as Finder's search field offers under it. */
export function searchSuggestions(query: string): readonly SearchSuggestion[] {
  const words = query.trim();
  if (words === "") return [];
  const matches = (label: string) => label.toLowerCase().startsWith(words.toLowerCase());
  return [
    {
      group: "Filenames",
      label: `Name matches: ${words}`,
      criterion: { field: "name", op: "contains", value: words },
    },
    ...CRITERION_KINDS.filter(({ id, label }) => id !== "any" && matches(label)).map(
      ({ id, label }): SearchSuggestion => ({
        group: "Kinds",
        label,
        criterion: { field: "kind", op: "is", value: id },
      }),
    ),
    ...TAGS.filter(({ name }) => matches(name)).map(
      ({ name }): SearchSuggestion => ({
        group: "Tags",
        label: name,
        criterion: { field: "tags", op: "contains", value: name },
      }),
    ),
  ];
}

/** The list under the search field. A press keeps the keyboard in the field. */
export function FinderSearchSuggestions({
  id,
  suggestions,
  active,
  onPick,
}: {
  /** The list's id; the field names it, and the row `active` by `${id}-${active}`. */
  id: string;
  suggestions: readonly SearchSuggestion[];
  /** The row the arrow keys are on. */
  active: number;
  onPick: (suggestion: SearchSuggestion) => void;
}) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label="Search suggestions"
      className="mac-finder-suggestions"
      onMouseDown={(event) => event.preventDefault()}
    >
      {suggestions.map((suggestion, at) => (
        // biome-ignore lint/a11y/useKeyWithClickEvents: the field's arrow keys and Return choose a row; the keyboard stays in the field.
        <div
          key={`${suggestion.group}/${suggestion.label}`}
          id={`${id}-${at}`}
          role="option"
          tabIndex={-1}
          aria-selected={at === active}
          className="mac-finder-suggestion"
          onClick={() => onPick(suggestion)}
        >
          {suggestion.group === "Filenames"
            ? suggestion.label
            : `${suggestion.group}: ${suggestion.label}`}
        </div>
      ))}
    </div>
  );
}
