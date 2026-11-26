"use client";

import {
  ScopeBar,
  ScopeBarAction,
  ScopeBarActionGroup,
  ScopeBarActions,
} from "macalicious/scope-bar";
import { SearchField } from "macalicious/search-field";
import type { Ref } from "react";

/** What Safari's Find banner shows: the words, and how many the page holds. */
export interface SafariFind {
  query: string;
  count: number;
  /** Which match is selected, from 1; 0 when none is. */
  at: number;
}

/** The next match's number, going round the page. */
export function nextMatch(find: SafariFind, back: boolean): number {
  if (find.count === 0) return 0;
  if (back) return find.at <= 1 ? find.count : find.at - 1;
  return find.at >= find.count ? 1 : find.at + 1;
}

/** How many matches the page's script counts before it stops. */
const COUNTED_MATCHES = 2_000;

/** Every match of the words in the text under `root`, in reading order, at most what a page counts. */
export function findRanges(root: Element, query: string): Range[] {
  const wanted = query.toLowerCase();
  if (wanted === "") return [];
  const ranges: Range[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.nodeValue ?? "").toLowerCase();
    let at = text.indexOf(wanted);
    while (at >= 0 && ranges.length < COUNTED_MATCHES && at + wanted.length <= text.length) {
      const range = root.ownerDocument.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + wanted.length);
      ranges.push(range);
      at = text.indexOf(wanted, at + wanted.length);
    }
  }
  return ranges;
}

/**
 * Lights the matches of a view of Safari's own, the one selected the brightest, and scrolls it into
 * view. A browser without the Highlight API still counts and scrolls, and lights nothing.
 */
export function lightMatches(ranges: readonly Range[], selected: number): void {
  const highlights = globalThis.CSS?.highlights;
  const current = ranges[selected];
  if (highlights && typeof Highlight !== "undefined") {
    highlights.delete("safari-find");
    highlights.delete("safari-find-current");
    if (ranges.length > 0) highlights.set("safari-find", new Highlight(...ranges));
    if (current) highlights.set("safari-find-current", new Highlight(current));
  }
  current?.startContainer.parentElement?.scrollIntoView?.({ block: "center" });
}

/** How Safari counts the matches. */
export function matchesText(find: SafariFind): string {
  if (find.query === "") return "";
  if (find.count === 0) return "Not Found";
  // The page counts up to this: past it, no number names the match selected.
  if (find.count >= COUNTED_MATCHES) return "More than 2,000 matches";
  return find.count === 1 ? "1 match" : `${find.at} of ${find.count} matches`;
}

/** The banner above a page while Find is open: Return is the next match, Escape closes it. */
export function SafariFindBanner({
  find,
  fieldRef,
  onQueryChange,
  onStep,
  onDone,
}: {
  find: SafariFind;
  fieldRef: Ref<HTMLDivElement>;
  onQueryChange: (query: string) => void;
  onStep: (back: boolean) => void;
  onDone: () => void;
}) {
  return (
    <ScopeBar surface="toolbar" className="mac-safari-find" aria-label="Find">
      <div ref={fieldRef} className="mac-safari-find-field">
        <SearchField
          aria-label="Find in page"
          value={find.query}
          onValueChange={onQueryChange}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onStep(event.shiftKey);
            } else if (event.key === "Escape") {
              event.preventDefault();
              onDone();
            }
          }}
        />
      </div>
      <ScopeBarActions>
        <span role="status">{matchesText(find)}</span>
        <ScopeBarActionGroup aria-label="Matches">
          <ScopeBarAction
            glyph="previous"
            aria-label="Previous match"
            disabled={find.count === 0}
            onClick={() => onStep(true)}
          />
          <ScopeBarAction
            glyph="next"
            aria-label="Next match"
            disabled={find.count === 0}
            onClick={() => onStep(false)}
          />
        </ScopeBarActionGroup>
        <ScopeBarAction onClick={onDone}>Done</ScopeBarAction>
      </ScopeBarActions>
    </ScopeBar>
  );
}
