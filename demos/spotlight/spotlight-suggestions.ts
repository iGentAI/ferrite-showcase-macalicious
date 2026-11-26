"use client";

import { useEffect, useState } from "react";
import { quotesFromServer } from "../desktop/desktop-notifications";
import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import { type WeatherAnswer, weatherFor } from "../maps/maps-weather";
import {
  catalogueFromServer,
  feedFromServer,
  type LiveStory,
  libraryFromServer,
  NEWS_URLS,
} from "../news/news-live";

/**
 * The row a Mac would put under Top Hit: the first whose title is what was typed, or else starts with
 * it, or else has a word that does. A title that only holds the text inside a word is no top hit.
 */
export function topHitOf(
  text: string,
  rows: readonly { value: string; title: string }[],
): string | undefined {
  if (text === "") return undefined;
  const rank = (title: string) => {
    const lower = title.toLowerCase();
    if (lower === text) return 0;
    if (lower.startsWith(text)) return 1;
    return lower.split(/[\s._-]+/).some((word) => word.startsWith(text)) ? 2 : 3;
  };
  let best: { value: string; rank: number } | undefined;
  for (const { value, title } of rows) {
    const each = rank(title);
    if (each < 3 && (!best || each < best.rank)) best = { value, rank: each };
  }
  return best?.value;
}

const SOURCE_CODE =
  /\.(?:c|cc|cpp|cs|go|h|hpp|java|js|jsx|kt|m|mjs|php|pl|py|rb|rs|scala|sh|sql|swift|ts|tsx)$/i;

/** A file of source code, which a Mac lists under Developer. */
export const isDeveloperFile = (name: string) => SOURCE_CODE.test(name);

export interface StockSuggestion {
  symbol: string;
  price: number;
  change: number;
}

const ASKED_WEATHER = /^(?:weather|forecast)(?:\s+(?:in|for|at))?(?:\s+(.+))?$/i;
const WEATHER_AFTER = /^(.+?)\s+(?:weather|forecast)$/i;

/**
 * Whether a query asks for the weather, and where: `{ place: "Paris" }` for "weather in Paris" or
 * "Paris weather", `{}` for "weather" alone, `undefined` for anything else.
 */
export function askedWeather(query: string): { place?: string } | undefined {
  const text = query.trim();
  const asked = text.match(ASKED_WEATHER) ?? text.match(WEATHER_AFTER);
  if (!asked) return undefined;
  return asked[1] ? { place: asked[1] } : {};
}

/** The weather a query asks for, once it is read; `null` when it asks for none. */
export function useWeatherSuggestion(query: string, enabled: boolean): WeatherAnswer | null {
  const asked = enabled ? askedWeather(query) : undefined;
  const wanted = asked ? (asked.place ?? "") : null;
  const [found, setFound] = useState<WeatherAnswer | null>(null);
  useEffect(() => {
    setFound(null);
    if (wanted === null) return undefined;
    let current = true;
    const pause = setTimeout(() => {
      void weatherFor(wanted || undefined).then((answer) => {
        if (current) setFound(answer);
      });
    }, PAUSE_MS);
    return () => {
      current = false;
      clearTimeout(pause);
    };
  }, [wanted]);
  return found;
}

const ASKED_STOCK = /^(?:([A-Z][A-Z.]{0,5})|([a-z.^-]{1,12}) (?:stock|shares))$/i;
const PAUSE_MS = 300;

/**
 * The symbol a query asks for: capitals as typed, as in AAPL, or a word before "stock". Lower-case
 * words alone are ordinary searches and stay on this desktop.
 */
export function askedSymbol(query: string): string | undefined {
  const match = query.trim().match(ASKED_STOCK);
  const typed = match?.[1];
  if (typed) return typed === typed.toUpperCase() ? typed : undefined;
  return match?.[2]?.toUpperCase();
}

/** The quote for what the query asks for, from the Stocks module; nothing when it has none. */
export function useStockSuggestion(query: string, enabled: boolean): StockSuggestion | null {
  const symbol = enabled ? askedSymbol(query) : undefined;
  const [found, setFound] = useState<StockSuggestion | null>(null);
  useEffect(() => {
    setFound(null);
    if (!symbol) return undefined;
    let current = true;
    const pause = setTimeout(() => {
      void withDeadline(async (signal) => {
        const response = await sessionFetch(
          `/api/stocks/quotes?symbols=${encodeURIComponent(symbol)}`,
          { credentials: "same-origin", signal },
        );
        if (!response.ok) return null;
        const quote = quotesFromServer(await response.json()).find(
          (each) => each.symbol === symbol,
        );
        return quote ? { symbol, price: quote.price, change: quote.change } : null;
      })
        .catch(() => null)
        .then((quote) => {
          if (current) setFound(quote ?? null);
        });
    }, PAUSE_MS);
    return () => {
      current = false;
      clearTimeout(pause);
    };
  }, [symbol]);
  return found;
}

/** How short a query is too short to look for in the news, how many feeds it reads and rows it shows. */
const NEWS_LEAST_CHARS = 3;
const NEWS_FEEDS = 6;
const NEWS_SHOWN = 3;
/** How long what was read from News serves further queries. */
const NEWS_KEPT_MS = 5 * 60_000;

/** The stories that hold the words of the query in their headlines or summaries, at most three. */
export function storiesMatching(stories: readonly LiveStory[], query: string): LiveStory[] {
  const words = query.trim().toLowerCase().split(/\s+/);
  if (words.join(" ").length < NEWS_LEAST_CHARS) return [];
  const seen = new Set<string>();
  return stories
    .filter((story) => {
      const text = `${story.title}\n${story.summary ?? ""}`.toLowerCase();
      if (seen.has(story.title) || !words.every((word) => text.includes(word))) return false;
      seen.add(story.title);
      return true;
    })
    .slice(0, NEWS_SHOWN);
}

const readJson = (url: string) =>
  withDeadline(async (signal) => {
    const response = await sessionFetch(url, { credentials: "same-origin", signal });
    return response.ok ? ((await response.json()) as unknown) : null;
  }).catch(() => null);

/** The stories of the channels the person follows, as the News module serves them. */
async function followedStories(): Promise<readonly LiveStory[]> {
  const [catalogue, library] = await Promise.all([
    readJson(NEWS_URLS.catalogue).then(catalogueFromServer),
    readJson(NEWS_URLS.library).then(libraryFromServer),
  ]);
  const followed = library?.following.length ? library.following : catalogue?.following;
  const feeds = await Promise.all(
    (followed ?? [])
      .slice(0, NEWS_FEEDS)
      .map(async (id) => feedFromServer(await readJson(NEWS_URLS.source(id)), id)),
  );
  return feeds.flatMap((feed) => feed?.stories ?? []);
}

let newsRead: { at: number; stories: Promise<readonly LiveStory[]> } | null = null;

function storiesRead(): Promise<readonly LiveStory[]> {
  if (!newsRead || Date.now() - newsRead.at > NEWS_KEPT_MS) {
    const stories = followedStories();
    newsRead = { at: Date.now(), stories };
    void stories.then((read) => {
      if (read.length === 0 && newsRead?.stories === stories) newsRead = null;
    });
  }
  return newsRead.stories;
}

/** The stories in the person's feeds the query finds; none while it is read or when it finds none. */
export function useNewsSuggestions(query: string, enabled: boolean): readonly LiveStory[] {
  const wanted = enabled && query.trim().length >= NEWS_LEAST_CHARS ? query.trim() : "";
  const [found, setFound] = useState<readonly LiveStory[]>([]);
  useEffect(() => {
    setFound([]);
    if (!wanted) return undefined;
    let current = true;
    const pause = setTimeout(() => {
      void storiesRead().then((stories) => {
        if (current) setFound(storiesMatching(stories, wanted));
      });
    }, PAUSE_MS);
    return () => {
      current = false;
      clearTimeout(pause);
    };
  }, [wanted]);
  return found;
}
