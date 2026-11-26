"use client";

import { TodayWidget } from "macalicious/today-widget";
import { useEffect, useState } from "react";
import { NewsMark } from "./news-artwork";
import {
  ageOf,
  feedFromServer,
  type LiveFeed,
  type LiveStory,
  libraryFromServer,
  libraryReadable,
  mergeStories,
  NEWS_URLS,
  openStoryLink,
} from "./news-live";
import { DEFAULT_FOLLOWING, getJson } from "./news-live-hooks";
import "./news.tokens.css";
import "./news.css";

/** How many headlines the widget lists, from all the channels the person follows. */
export const WIDGET_STORIES = 4;
/** How many feeds the widget asks for at once. */
const WIDGET_REQUESTS = 4;

/**
 * News's widget in Notification Center's Today view, on the desktop served by the Ferrite
 * application: the newest headlines of the channels the person follows, each opening its story
 * at the publisher (in Safari when a Safari window is open, otherwise in a browser tab). It reads
 * the same routes as the News window (`/api/news/library`, `/api/news/sources/<id>`) and changes
 * nothing.
 */
export function NewsTodayWidget() {
  const [stories, setStories] = useState<readonly LiveStory[]>();
  const [failed, setFailed] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let current = true;
    void (async () => {
      const reply = await getJson(NEWS_URLS.library).catch(() => undefined);
      // Only a library never saved means the default channels; one that could not be read
      // shows nothing rather than channels the person may have unfollowed or blocked.
      if (!reply?.ok || !libraryReadable(reply.body)) {
        if (current) setFailed(true);
        return;
      }
      const library = libraryFromServer(reply.body);
      const blocked = library?.blocked ?? [];
      const sources = (library?.following ?? DEFAULT_FOLLOWING).filter(
        (id) => !blocked.includes(id),
      );
      // Every followed channel is read, at most `WIDGET_REQUESTS` at a time.
      const feeds: (LiveFeed | undefined)[] = new Array(sources.length);
      let next = 0;
      const worker = async () => {
        while (next < sources.length) {
          const at = next++;
          const source = sources[at] as string;
          feeds[at] = await getJson(NEWS_URLS.source(source))
            .then((answer) => (answer.ok ? feedFromServer(answer.body, source) : undefined))
            .catch(() => undefined);
        }
      };
      await Promise.all(Array.from({ length: Math.min(WIDGET_REQUESTS, sources.length) }, worker));
      if (!current) return;
      const read = feeds.filter((feed): feed is LiveFeed => feed !== undefined);
      if (sources.length > 0 && read.length === 0) setFailed(true);
      setStories(mergeStories(read.map((feed) => feed.stories)).slice(0, WIDGET_STORIES));
    })();
    return () => {
      current = false;
    };
  }, []);

  return (
    <TodayWidget title="News" icon={<NewsMark />} className="mac-news-widget">
      {stories === undefined ? (
        <p className="mac-news-widget-note">{failed ? "News is not available." : "Loading…"}</p>
      ) : stories.length === 0 ? (
        <p className="mac-news-widget-note">
          {failed ? "News is not available." : "Follow a channel in News."}
        </p>
      ) : (
        <ul className="mac-news-widget-list">
          {stories.map((story) => (
            <li key={`${story.source}.${story.id}`}>
              <button
                type="button"
                className="mac-news-widget-story"
                disabled={!story.link}
                onClick={() => story.link && openStoryLink(story.link)}
              >
                <span className="mac-news-widget-publisher">{story.publisher}</span>
                <span className="mac-news-widget-headline">{story.title}</span>
                <span className="mac-news-widget-age">{ageOf(story.published, now)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </TodayWidget>
  );
}
