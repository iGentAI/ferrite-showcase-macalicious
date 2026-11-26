import type { MailboxId, MailSettings } from "./mail-data";
import type { SmartRule } from "./mail-smart";
import type { SmartDraft } from "./mail-smart-sheet";

/** A criterion of a search, drawn as a token in the search field. */
export interface SearchToken {
  field: "from" | "subject";
  value: string;
}

export const TOKEN_LABEL: Readonly<Record<SearchToken["field"], string>> = {
  from: "From",
  subject: "Subject",
};

const unquote = (value: string) => value.replace(/^"(.*)"$/, "$1").trim();

/**
 * A criterion that has been finished in the text typed: `from:ada ` or `subject:"two words" `, ended
 * by a space, and what was typed after it.
 */
export function finishedToken(text: string): { token: SearchToken; rest: string } | null {
  const found = /^\s*(from|subject):\s*("[^"]+"|[^\s"]+)\s+(.*)$/i.exec(text);
  if (!found) return null;
  const [, field = "", value = "", rest = ""] = found;
  return {
    token: { field: field.toLowerCase() as SearchToken["field"], value: unquote(value) },
    rest,
  };
}

/** The whole text as a criterion, when it is written as one: what Return and matching read. */
export function wholeToken(text: string): SearchToken | null {
  const found = /^\s*(from|subject):\s*(.+)$/i.exec(text);
  if (!found) return null;
  const value = unquote(found[2] ?? "");
  return value ? { field: (found[1] ?? "").toLowerCase() as SearchToken["field"], value } : null;
}

/** What a search asks of a message: all of it must hold. */
export function searchRules(tokens: readonly SearchToken[], text: string): SmartRule[] {
  const typed = wholeToken(text);
  const words = typed ? "" : text.trim();
  return [
    ...[...tokens, ...(typed ? [typed] : [])].map(({ field, value }) => ({
      field,
      test: "contains" as const,
      value,
    })),
    ...(words ? [{ field: "message" as const, test: "contains" as const, value: words }] : []),
  ];
}

/**
 * The Smart Mailbox a search becomes: the search's conditions, the mailbox it is scoped to, never a
 * Smart Mailbox, whose Save is dimmed, and the mailboxes it looked through.
 */
export function smartFromSearch(
  tokens: readonly SearchToken[],
  text: string,
  scope: MailboxId | null,
  settings: MailSettings,
): SmartDraft {
  const rules = searchRules(tokens, text);
  return {
    name: rules[0]?.value ?? "",
    matchAll: true,
    rules: scope ? [...rules, { field: "mailbox", test: "is", value: scope }] : rules,
    includeTrash: scope === "trash" || (scope === null && settings.searchTrash === true),
    includeSent: true,
    includeJunk: scope === "junk" || (scope === null && settings.searchJunk === true),
    includeDrafts: scope === "drafts" || scope === null,
  };
}
