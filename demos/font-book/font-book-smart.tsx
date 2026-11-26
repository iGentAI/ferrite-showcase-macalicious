"use client";

import { DefaultButton } from "macalicious/default-button";
import { Form, FormRow } from "macalicious/form";
import { ImageButton } from "macalicious/image-button";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { SystemImage } from "macalicious/system-image";
import { TextField } from "macalicious/text-field";
import { useState } from "react";
import {
  type FontCollection,
  type FontFamily,
  type FontKind,
  postScriptName,
} from "./font-book-data";

/*
 * File > New Smart Collection and Edit > Edit Smart Collection: a collection that follows rules, kept
 * among the person's desktop values, since the server's library holds plain lists.
 */

export type SmartField = "family" | "style" | "postscript" | "language" | "kind";
export type SmartTest = "contains" | "is" | "excludes";

export interface SmartRule {
  field: SmartField;
  test: SmartTest;
  value: string;
}

export interface SmartCollection {
  id: string;
  name: string;
  /** Whether a family has to meet every rule, or any of them. */
  match: "all" | "any";
  rules: readonly SmartRule[];
}

const FIELDS: readonly [SmartField, string][] = [
  ["family", "Family Name"],
  ["style", "Style Name"],
  ["postscript", "PostScript Name"],
  ["language", "Language"],
  ["kind", "Kind"],
];
const TESTS: readonly [SmartTest, string][] = [
  ["contains", "contains"],
  ["is", "is"],
  ["excludes", "does not contain"],
];
const KINDS: readonly [FontKind, string][] = [
  ["sans", "Sans Serif"],
  ["serif", "Serif"],
  ["mono", "Fixed Width"],
  ["script", "Script"],
  ["display", "Display"],
  ["symbol", "Symbol"],
  ["cjk", "East Asian"],
];

const MAX_NAME = 100;
const MAX_RULES = 12;

const valuesOf = (family: FontFamily, field: SmartField): readonly string[] => {
  if (field === "family") return [family.name];
  if (field === "language") return [family.script];
  if (field === "kind") return [family.kind];
  if (field === "style") return family.styles.map(({ name }) => name);
  return family.styles.map((style) => postScriptName(family, style));
};

function meets(family: FontFamily, { field, test, value }: SmartRule): boolean {
  const wanted = value.trim().toLowerCase();
  const values = valuesOf(family, field).map((each) => each.toLowerCase());
  if (test === "is") return values.includes(wanted);
  const found = values.some((each) => each.includes(wanted));
  return test === "contains" ? found : !found;
}

/** The families a smart collection holds. A rule with nothing typed asks nothing. */
export function matchesSmart(family: FontFamily, { match, rules }: SmartCollection): boolean {
  const asked = rules.filter(({ value }) => value.trim() !== "");
  if (asked.length === 0) return false;
  return match === "all"
    ? asked.every((rule) => meets(family, rule))
    : asked.some((rule) => meets(family, rule));
}

export const smartCollectionOf = (smart: SmartCollection): FontCollection => ({
  id: smart.id,
  name: smart.name,
  icon: "smart",
  matches: (family) => matchesSmart(family, smart),
});

const isRule = (value: unknown): value is SmartRule => {
  const rule = value as Partial<SmartRule> | null;
  return (
    typeof rule === "object" &&
    rule !== null &&
    FIELDS.some(([field]) => field === rule.field) &&
    TESTS.some(([test]) => test === rule.test) &&
    typeof rule.value === "string"
  );
};

/** What each stored list read as: `useKeptValue` takes a new array for a new value, on every render. */
const readLists = new WeakMap<object, readonly SmartCollection[]>();

/** The kept collections; one that cannot be read is left out, not guessed at. */
export function readSmartCollections(stored: unknown): readonly SmartCollection[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  const known = readLists.get(stored);
  if (known) return known;
  const read = stored.filter((value): value is SmartCollection => {
    const smart = value as Partial<SmartCollection> | null;
    return (
      typeof smart === "object" &&
      smart !== null &&
      typeof smart.id === "string" &&
      typeof smart.name === "string" &&
      (smart.match === "all" || smart.match === "any") &&
      Array.isArray(smart.rules) &&
      smart.rules.every(isRule)
    );
  });
  readLists.set(stored, read);
  return read;
}

export const NO_SMART_COLLECTIONS: readonly SmartCollection[] = [];

const blankRule: SmartRule = { field: "family", test: "contains", value: "" };

/** A new smart collection, not yet kept, under a name no other has. */
export function newSmartCollection(existing: readonly SmartCollection[]): SmartCollection {
  const taken = new Set(existing.map(({ name }) => name));
  let name = "Smart Collection";
  for (let number = 2; taken.has(name); number += 1) name = `Smart Collection ${number}`;
  return {
    id: `smart-${Date.now().toString(36)}`,
    name,
    match: "all",
    rules: [blankRule],
  };
}

/** The sheet of the two commands: the name, All or Any, and the rules. */
export function SmartCollectionSheet({
  editing,
  anchor,
  onSave,
  onClose,
}: {
  /** The collection edited; `null` while the sheet is closed. */
  editing: SmartCollection | null;
  anchor: HTMLElement | null;
  onSave: (smart: SmartCollection) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={editing !== null} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={520}>
        {editing ? <SmartCollectionForm key={editing.id} first={editing} onSave={onSave} /> : null}
      </SheetPopup>
    </Sheet>
  );
}

function SmartCollectionForm({
  first,
  onSave,
}: {
  first: SmartCollection;
  onSave: (smart: SmartCollection) => void;
}) {
  const [draft, setDraft] = useState(first);
  const change = (index: number, next: Partial<SmartRule>) =>
    setDraft({
      ...draft,
      rules: draft.rules.map((rule, at) => (at === index ? { ...rule, ...next } : rule)),
    });
  const asks = draft.rules.some(({ value }) => value.trim() !== "");
  const name = draft.name.trim();
  return (
    <>
      <SheetTitle>Smart Collection</SheetTitle>
      <SheetDescription>The collection holds the families that meet its rules.</SheetDescription>
      <Form size="small" onSubmit={(event) => event.preventDefault()}>
        <FormRow label="Collection Name:">
          <TextField
            aria-label="Collection Name"
            size="small"
            maxLength={MAX_NAME}
            value={draft.name}
            onValueChange={(value) => setDraft({ ...draft, name: value })}
          />
        </FormRow>
        <FormRow label="Match:">
          <PopUpButton
            aria-label="Match"
            size="small"
            value={draft.match}
            onValueChange={(value) =>
              setDraft({ ...draft, match: value as SmartCollection["match"] })
            }
          >
            <PopUpButtonItem value="all">All of the rules</PopUpButtonItem>
            <PopUpButtonItem value="any">Any of the rules</PopUpButtonItem>
          </PopUpButton>
        </FormRow>
      </Form>
      <ul className="mac-font-book-smart-rules" aria-label="Rules">
        {draft.rules.map((rule, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a rule is its place in the list, and has no identity of its own
          <li key={index} className="mac-font-book-smart-rule">
            <PopUpButton
              aria-label={`Rule ${index + 1} field`}
              size="small"
              value={rule.field}
              onValueChange={(value) => {
                const field = value as SmartField;
                change(
                  index,
                  field === "kind"
                    ? { field, test: "is", value: "sans" }
                    : { field, value: rule.field === "kind" ? "" : rule.value },
                );
              }}
            >
              {FIELDS.map(([value, title]) => (
                <PopUpButtonItem key={value} value={value}>
                  {title}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
            {rule.field === "kind" ? (
              <PopUpButton
                aria-label={`Rule ${index + 1} kind`}
                size="small"
                value={rule.value}
                onValueChange={(value) => change(index, { value: value as string })}
              >
                {KINDS.map(([value, title]) => (
                  <PopUpButtonItem key={value} value={value}>
                    {title}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            ) : (
              <>
                <PopUpButton
                  aria-label={`Rule ${index + 1} test`}
                  size="small"
                  value={rule.test}
                  onValueChange={(value) => change(index, { test: value as SmartTest })}
                >
                  {TESTS.map(([value, title]) => (
                    <PopUpButtonItem key={value} value={value}>
                      {title}
                    </PopUpButtonItem>
                  ))}
                </PopUpButton>
                <TextField
                  aria-label={`Rule ${index + 1} value`}
                  size="small"
                  maxLength={MAX_NAME}
                  value={rule.value}
                  onValueChange={(value) => change(index, { value })}
                />
              </>
            )}
            <ImageButton
              aria-label={`Remove rule ${index + 1}`}
              disabled={draft.rules.length === 1}
              onClick={() =>
                setDraft({ ...draft, rules: draft.rules.filter((_, at) => at !== index) })
              }
            >
              <SystemImage name="remove" />
            </ImageButton>
            <ImageButton
              aria-label={`Add a rule after rule ${index + 1}`}
              disabled={draft.rules.length >= MAX_RULES}
              onClick={() =>
                setDraft({
                  ...draft,
                  rules: [
                    ...draft.rules.slice(0, index + 1),
                    blankRule,
                    ...draft.rules.slice(index + 1),
                  ],
                })
              }
            >
              <SystemImage name="add" />
            </ImageButton>
          </li>
        ))}
      </ul>
      <SheetActions>
        <SheetClose>Cancel</SheetClose>
        <DefaultButton disabled={!asks || name === ""} onClick={() => onSave({ ...draft, name })}>
          OK
        </DefaultButton>
      </SheetActions>
    </>
  );
}
