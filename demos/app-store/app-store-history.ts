import type { AppStoreSection } from "./app-store-data";

/** The page the store shows: what Back and Forward move between. */
export interface AppStorePlace {
  section: AppStoreSection;
  /** The search field's text; a page of results when it holds more than white space. */
  query: string;
  /** The category chosen on the Categories page, whose results are its apps. */
  category: string | null;
  /** Whether the account page is shown. */
  account: boolean;
  /** The store id of the app whose page is shown. A search shows over it, as over any page. */
  app?: string | null;
}

/** The pages visited, the one shown, and how far each was scrolled when it was left. */
export interface AppStoreHistory {
  entries: readonly (AppStorePlace & { scrollTop: number })[];
  at: number;
}

/** The most pages kept; the oldest go first. */
const MAX_ENTRIES = 100;

export const startHistory = (place: AppStorePlace): AppStoreHistory => ({
  entries: [{ ...place, scrollTop: 0 }],
  at: 0,
});

const samePage = (a: AppStorePlace, b: AppStorePlace) =>
  a.section === b.section &&
  a.query.trim() === b.query.trim() &&
  a.category === b.category &&
  a.account === b.account &&
  (a.app ?? null) === (b.app ?? null);

const typedSearch = (place: AppStorePlace) => place.query.trim() !== "" && place.category === null;

function leaving(history: AppStoreHistory, scrollTop: number) {
  return history.entries.map((entry, index) =>
    index === history.at ? { ...entry, scrollTop } : entry,
  );
}

/**
 * `next` is shown, and `scrollTop` is how far the page left was scrolled. What is ahead is dropped.
 * A search as it is typed is one page: each letter replaces the last, and clearing the field goes
 * back to the page it was typed over.
 */
export function visit(
  history: AppStoreHistory,
  next: AppStorePlace,
  scrollTop: number,
): AppStoreHistory {
  const current = history.entries[history.at];
  if (!current || samePage(current, next)) return history;
  const before = leaving(history, scrollTop).slice(0, history.at + 1);
  if (typedSearch(current)) {
    const previous = before[before.length - 2];
    if (typedSearch(next)) {
      before[before.length - 1] = { ...next, scrollTop: 0 };
      return { entries: before, at: before.length - 1 };
    }
    if (previous && samePage(previous, next)) {
      return { entries: before.slice(0, -1), at: before.length - 2 };
    }
  }
  const entries = [...before, { ...next, scrollTop: 0 }].slice(-MAX_ENTRIES);
  return { entries, at: entries.length - 1 };
}

/** Moves `by` pages back (-1) or forward (1), if there is a page there. */
export function move(history: AppStoreHistory, by: -1 | 1, scrollTop: number): AppStoreHistory {
  const at = history.at + by;
  if (at < 0 || at >= history.entries.length) return history;
  return { entries: leaving(history, scrollTop), at };
}

/** The account page is gone: signing out leaves no way back to it, and shows the page before it. */
export function forgetAccount(history: AppStoreHistory): AppStoreHistory {
  const entries: (AppStorePlace & { scrollTop: number })[] = [];
  let at = 0;
  history.entries.forEach((entry, index) => {
    if (!entry.account || entry.query.trim() !== "") {
      const place = { ...entry, account: false };
      const last = entries[entries.length - 1];
      if (!last || !samePage(last, place)) entries.push(place);
    }
    if (index === history.at) at = Math.max(entries.length - 1, 0);
  });
  if (entries.length > 0) return { entries, at };
  const section = history.entries[0]?.section ?? "discover";
  return startHistory({ section, query: "", category: null, account: false });
}
