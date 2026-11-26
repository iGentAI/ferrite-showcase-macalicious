"use client";

import { CardGrid } from "macalicious/card-grid";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { type CSSProperties, type ReactNode, useEffect, useId, useRef } from "react";
import { PlayMark, StoryPicture } from "./news-artwork";
import { type NewsStory, storyKey } from "./news-data";

/** The story grids stand in the feed's column, which has the margins: the grid's are zero. */
export const STORY_GRID = { "--mac-card-grid-margin": "0px" } as CSSProperties;
/** A list's rows are 20 pt apart. */
const LIST_GRID = { ...STORY_GRID, "--mac-card-grid-row-gap": "20px" } as CSSProperties;

/** A point of the screen: the middle of a story. */
export interface StoryPlace {
  x: number;
  y: number;
}

/**
 * Which of `places` an arrow key goes to from the one at `from`: the nearest in that direction, a
 * story out of line counting for more than one further along.
 */
export function storyToward(
  places: readonly StoryPlace[],
  from: number,
  key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
): number | undefined {
  const start = places[from];
  if (!start) return undefined;
  const vertical = key === "ArrowUp" || key === "ArrowDown";
  const sign = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
  let best: number | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  places.forEach((place, index) => {
    const along = sign * (vertical ? place.y - start.y : place.x - start.x);
    const across = Math.abs(vertical ? place.x - start.x : place.y - start.y);
    const score = along + across * 3;
    if (index !== from && along > 1 && score < bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

export interface StoryProps {
  story: NewsStory;
  /** "lead": the picture above, large; "beside": the text with a small picture after it. */
  layout: "lead" | "beside";
  /** The level of the headline's heading: one under the heading that names the list. */
  level: 3 | 4;
  onOpen: (story: NewsStory) => void;
  /** The rows of the story's contextual menu; without it the story has none. */
  menu?: (story: NewsStory) => ReactNode;
  /** Whether the story is one of those chosen. */
  picked?: boolean;
  /** Heard for a Command-click or Shift-click, which then does not open the story. */
  onPick?: (story: NewsStory, range: boolean) => void;
  /** The story's address, which a drag carries; a story without one does not drag. */
  linkOf?: (story: NewsStory) => string | undefined;
}

/** One story: its picture, then the publisher, the headline, which opens it, and its age. */
export function Story({ story, layout, level, onOpen, menu, picked, onPick, linkOf }: StoryProps) {
  const Headline = level === 3 ? "h3" : "h4";
  const link = linkOf?.(story);
  const card = (
    <article
      className="mac-news-story"
      data-layout={layout}
      draggable={link ? true : undefined}
      onDragStart={
        link
          ? (event) => {
              event.dataTransfer.effectAllowed = "copy";
              event.dataTransfer.setData("text/uri-list", link);
              event.dataTransfer.setData("text/plain", link);
            }
          : undefined
      }
    >
      <span className="mac-news-story-art">
        <StoryPicture id={story.id} src={story.image} />
        {story.video && layout === "lead" ? <PlayMark /> : null}
      </span>
      <div className="mac-news-story-text">
        <span className="mac-news-story-publisher">{story.publisher}</span>
        <Headline className="mac-news-story-headline">
          <button
            type="button"
            className="mac-news-story-link"
            data-story={storyKey(story)}
            aria-pressed={onPick ? picked === true : undefined}
            onClick={(event) => {
              if (onPick && (event.metaKey || event.ctrlKey || event.shiftKey)) {
                onPick(story, event.shiftKey);
              } else onOpen(story);
            }}
          >
            {story.headline}
          </button>
        </Headline>
        <span className="mac-news-story-age">{story.age}</span>
      </div>
    </article>
  );
  return menu ? (
    <ContextualMenu>
      <ContextualMenuTrigger className="mac-news-row-menu">{card}</ContextualMenuTrigger>
      <ContextualMenuPopup aria-label="Story">{menu(story)}</ContextualMenuPopup>
    </ContextualMenu>
  ) : (
    card
  );
}

export interface StoryListProps {
  title: string;
  stories: readonly NewsStory[];
  /** What the list says when it has no stories. */
  empty: ReactNode;
  /** Gives the title the focus when the list is shown: it took the place of what had it. */
  focusTitle?: boolean;
  onOpen: (story: NewsStory) => void;
  /** Shown between the title and the stories: a channel's buttons and its status. */
  header?: ReactNode;
  /** The rows of each story's contextual menu. */
  menu?: StoryProps["menu"];
  /** The keys of the stories chosen, in a list that lets them be. */
  picked?: readonly string[];
  onPick?: StoryProps["onPick"];
  linkOf?: StoryProps["linkOf"];
}

/** A channel, a destination or the search's results: a title and its stories two to a row. */
export function StoryList({
  title,
  stories,
  empty,
  focusTitle = false,
  onOpen,
  header,
  menu,
  picked,
  onPick,
  linkOf,
}: StoryListProps) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  // Only when the list is first shown: a list that is being read keeps the focus where it is.
  const focusAtFirst = useRef(focusTitle);
  useEffect(() => {
    if (focusAtFirst.current) heading.current?.focus();
  }, []);
  return (
    <div className="mac-news-column" data-view="list">
      <h2 ref={heading} id={id} tabIndex={-1} className="mac-news-title">
        {title}
      </h2>
      {header}
      {stories.length > 0 ? (
        <CardGrid aria-labelledby={id} columns={2} gap={22} style={LIST_GRID}>
          {stories.map((story) => (
            <Story
              key={storyKey(story)}
              story={story}
              layout="beside"
              level={3}
              onOpen={onOpen}
              menu={menu}
              picked={picked?.includes(story.id)}
              onPick={onPick}
              linkOf={linkOf}
            />
          ))}
        </CardGrid>
      ) : (
        <EmptyState className="mac-news-empty">{empty}</EmptyState>
      )}
    </div>
  );
}
