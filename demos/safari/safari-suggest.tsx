"use client";

/** A row under the address field: a page Safari knows, or the search for what was typed. */
export interface SafariSuggestion {
  url: string;
  title: string;
  kind: "top" | "known" | "search" | "engine";
}

export const SUGGESTIONS_SHOWN = 8;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * What Safari suggests for what was typed, from the person's own Favorites, bookmarks and history:
 * the pages holding every word, most visited first, the best as Top Hit when its host starts with
 * what was typed, then the search, then what the search engine suggests, when it was asked.
 */
export function suggestionsFor(
  typed: string,
  known: readonly { url: string; title: string; count?: number }[],
  search: (words: string) => string,
  engine: readonly string[] = [],
): SafariSuggestion[] {
  const words = typed.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const seen = new Set<string>();
  const found = known
    .filter(({ url, title }) => {
      const text = `${title} ${url}`.toLowerCase();
      if (seen.has(url) || !words.every((word) => text.includes(word))) return false;
      seen.add(url);
      return true;
    })
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  const first = typed.trim().toLowerCase();
  const at = found.findIndex(({ url }) => hostOf(url).startsWith(first));
  const ordered = at > 0 ? [found[at], ...found.filter((_, index) => index !== at)] : found;
  const rows = ordered
    .filter((one): one is NonNullable<typeof one> => one !== undefined)
    .slice(0, SUGGESTIONS_SHOWN - 1)
    .map(
      (one, index): SafariSuggestion => ({
        url: one.url,
        title: one.title || one.url,
        kind: index === 0 && at >= 0 ? "top" : "known",
      }),
    );
  return [
    ...rows,
    { url: search(typed), title: `Search for “${typed.trim()}”`, kind: "search" },
    ...engine
      .filter((title) => title.toLowerCase() !== first)
      .map((title): SafariSuggestion => ({ url: search(title), title, kind: "engine" })),
  ];
}

/** The list under the address field. The field keeps the keyboard: a press here does not take it. */
export function SafariSuggestions({
  rows,
  chosen,
  onOpen,
}: {
  rows: readonly SafariSuggestion[];
  chosen: number;
  onOpen: (url: string) => void;
}) {
  return (
    <div
      className="mac-safari-suggestions"
      role="listbox"
      aria-label="Suggestions"
      onMouseDown={(event) => event.preventDefault()}
    >
      {rows.map((row, index) => (
        <div
          key={`${row.kind} ${row.url}`}
          role="option"
          tabIndex={-1}
          aria-selected={index === chosen}
          data-chosen={index === chosen ? "" : undefined}
          className="mac-safari-suggestion"
          onClick={() => onOpen(row.url)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onOpen(row.url);
          }}
        >
          <span className="mac-safari-suggestion-kind">
            {row.kind === "top"
              ? "Top Hit"
              : row.kind === "known"
                ? "Your Pages"
                : row.kind === "engine"
                  ? "Wikipedia"
                  : "Search"}
          </span>
          <span className="mac-safari-suggestion-title">{row.title}</span>
          {row.kind === "search" || row.kind === "engine" ? null : (
            <span className="mac-safari-suggestion-url">{hostOf(row.url)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** The latest search among the pages behind the one shown, or -1: History > Search Results SnapBack. */
export function snapBackIndex(
  history: readonly string[],
  index: number,
  isSearch: (address: string) => boolean,
): number {
  for (let at = index - 1; at >= 0; at -= 1) {
    if (isSearch(history[at] ?? "")) return at;
  }
  return -1;
}
