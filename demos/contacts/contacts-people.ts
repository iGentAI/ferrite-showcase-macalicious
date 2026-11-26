import { useEffect, useState } from "react";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { sessionFetch } from "../desktop/desktop-server";

/** Someone in the person's Contacts who has a desktop account. */
export interface ContactPerson {
  /** The name on their card. */
  name: string;
  /** Their account name. */
  to: string;
}

const PEOPLE_URL = "/api/contacts/people";
const READ_MS = 15_000;

function peopleOf(reply: unknown): ContactPerson[] | null {
  const found = (reply as { people?: unknown } | null)?.people;
  if (!Array.isArray(found)) return null;
  return found.flatMap((person) => {
    const { user, full_name: full } = (person ?? {}) as { user?: unknown; full_name?: unknown };
    if (typeof user !== "string") return [];
    return [{ name: typeof full === "string" && full ? full : user, to: user }];
  });
}

/**
 * The cards of the person's Contacts that name a desktop user, on the served desktop, read again
 * when Contacts change. Only the latest read's answer counts, and what was read stays while a later
 * read fails.
 */
export function useContactPeople(on = true): readonly ContactPerson[] {
  const [people, setPeople] = useState<readonly ContactPerson[]>([]);
  useEffect(() => {
    if (!on) return;
    let latest = 0;
    const load = async () => {
      latest += 1;
      const asked = latest;
      const response = await sessionFetch(PEOPLE_URL, {
        credentials: "same-origin",
        signal: AbortSignal.timeout(READ_MS),
      }).catch(() => null);
      const reply: unknown = response?.ok ? await response.json().catch(() => null) : null;
      const found = peopleOf(reply);
      if (asked === latest && found) setPeople(found);
    };
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ app?: string }>).detail?.app === "contacts") void load();
    };
    void load();
    window.addEventListener(SERVER_CHANGE_EVENT, changed);
    return () => {
      latest = -1;
      window.removeEventListener(SERVER_CHANGE_EVENT, changed);
    };
  }, [on]);
  return people;
}

/** Those of `people` whose name or account name holds what was typed, but not the `taken`. */
export function offeredPeople(
  people: readonly ContactPerson[],
  typed: string,
  taken: readonly string[],
): readonly ContactPerson[] {
  const words = typed.trim().toLowerCase();
  if (!words) return [];
  return people
    .filter(
      ({ name, to }) =>
        !taken.includes(to) &&
        (name.toLowerCase().includes(words) || to.toLowerCase().includes(words)),
    )
    .slice(0, 5);
}
