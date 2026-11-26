"use client";

import { CardGrid } from "macalicious/card-grid";
import {
  CatalystChrome,
  CatalystSidebar,
  CatalystSidebarGroup,
  CatalystSidebarItem,
} from "macalicious/catalyst-chrome";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { ProgressSpinner } from "macalicious/progress-spinner";
import { PushButton } from "macalicious/push-button";
import { SearchField } from "macalicious/search-field";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage } from "macalicious/system-image";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import {
  type CSSProperties,
  type DragEvent,
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { linkAddress } from "../desktop/desktop-open-url";
import {
  changeDesktopValue,
  readNumber,
  useDesktopSetting,
  useDesktopValue,
} from "../desktop/desktop-personal";
import { copyText, LinkShareItems, NO_ADDRESS_REASON } from "../desktop/desktop-share-link";
import type { NewsProps } from "./news";
import { ChannelIcon, NewsMark, StoryPicture } from "./news-artwork";
import type { NewsStory } from "./news-data";
import {
  ageOf,
  channelOf,
  channelOfAddress,
  choiceAfter,
  findParts,
  type LiveCatalogue,
  type LiveChannel,
  type LiveStory,
  liveKey,
  liveMatches,
  MAX_SAVED,
  mastheadDate,
  mergeStories,
  movedBefore,
  type NewsLibrary,
  openStoryLink,
  type SavedStory,
  type StoryChoice,
  savedIsFull,
  summaryParagraphs,
  toggle,
  toggleSaved,
  toNewsStory,
  topStories,
  withoutStory,
  withVisit,
} from "./news-live";
import { type FeedState, useLiveNews, useStoryArticle } from "./news-live-hooks";
import { NEWS_TEXT_SCALES, useNewsMenus } from "./news-menus";

const NEWS_TEXT_SCALE = "news.textScale";
const readTextScale = (stored: unknown): number | undefined => {
  const scale = readNumber(stored);
  return NEWS_TEXT_SCALES.find((each) => each === scale);
};

import { STORY_GRID, Story, StoryList, type StoryProps, storyToward } from "./news-stories";
import "./news.tokens.css";
import "./news.css";

/** Measured: the three toolbar buttons are 39 pt wide. */
const TOOLBAR_BUTTON: CSSProperties = { width: 39 };
/** Measured: the search field is 161 pt wide. */
const SEARCH_FIELD: CSSProperties = { width: 161 };
const SIDEBAR = {
  "--mac-catalyst-chrome-sidebar-width": "calc(227px + 7px * var(--mac-appearance-dark))",
} as CSSProperties;
const NO_TOPIC_BLOCK =
  "Today reads your channels, not topics, so a topic has no stories to block. Unfollow Topic takes it out of the sidebar.";
/** The topics the person took out of the sidebar. */
const NEWS_HIDDEN_TOPICS = "news.hiddenTopics";
const readTopicIds = (stored: unknown): readonly string[] | undefined =>
  Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : undefined;
const NO_TOPICS: readonly string[] = [];
/** How many channels the person does not follow Today's Suggested For You reads, and its stories. */
const SUGGESTED_CHANNELS = 3;
const SUGGESTED_STORIES = 3;

/** What the window shows beside the sidebar. */
type View =
  | { kind: "today" | "top" | "saved" | "history" | "discover" }
  | { kind: "channel" | "topic"; id: string };

const viewId = (view: View) => ("id" in view ? `${view.kind}:${view.id}` : view.kind);

const TODAY: View = { kind: "today" };
/** The person's last view and whether the sidebar is hidden, in the desktop's settings. */
const NEWS_VIEW = "news.view";
interface NewsKept {
  view?: View;
  sidebarHidden?: boolean;
}
const NO_KEPT: NewsKept = {};

function readKeptNewsView(stored: unknown): View | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { kind, id } = stored as Record<string, unknown>;
  if (kind === "today" || kind === "top" || kind === "saved" || kind === "history") return { kind };
  if (kind === "discover") return { kind };
  if ((kind === "channel" || kind === "topic") && typeof id === "string") return { kind, id };
  return undefined;
}

/** What is kept of the window, with whatever of it reads. */
export function readNewsKept(stored: unknown): NewsKept | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { view, sidebarHidden } = stored as Record<string, unknown>;
  return { view: readKeptNewsView(view), sidebarHidden: sidebarHidden === true };
}

/** A story the window can open: one of a feed (with its summary) or one kept in the library. */
type Openable = LiveStory | SavedStory;

/** The feeds a view reads. */
function sourcesOf(view: View, following: readonly string[], catalogue?: LiveCatalogue) {
  switch (view.kind) {
    case "today":
    case "top":
      return following;
    case "channel":
      return [view.id];
    case "topic":
      return catalogue?.topics.find((topic) => topic.id === view.id)?.sources ?? [];
    default:
      return [];
  }
}

/** "Updated 5m ago", or why the stories could not be read, for the feeds of a view. */
function Status({
  states,
  names,
  now,
}: {
  states: readonly (FeedState | undefined)[];
  names: readonly string[];
  now: number;
}) {
  const loading = states.some((state) => !state || state.loading);
  const failed = states
    .map((state, index) => (state?.error || state?.feed?.error ? names[index] : undefined))
    .filter((name): name is string => name !== undefined);
  const fetched = states.map((state) => state?.feed?.fetched ?? 0).filter((at) => at > 0);
  const oldest = fetched.length > 0 ? Math.min(...fetched) : undefined;
  return (
    <div className="mac-news-status" role="status">
      {loading ? (
        <>
          <ProgressSpinner size="small" aria-label="Loading stories" /> Loading stories…
        </>
      ) : oldest !== undefined ? (
        `Updated ${ageOf(oldest, now).toLowerCase() || "just now"}`
      ) : null}
      {failed.length > 0 ? ` · Could not refresh ${failed.join(", ")}.` : null}
    </div>
  );
}

interface ReaderProps {
  story: Openable;
  now: number;
  saved: boolean;
  textScale: number;
  onToggleSaved: () => void;
  /** Where the reader leaves the command that shows its find bar. */
  showFind: RefObject<(() => void) | null>;
}

/** The find bar over a story: what is sought, how many places hold it, and moving between them. */
function FindBar({
  query,
  count,
  at,
  asked,
  onQuery,
  onMove,
  onClose,
}: {
  query: string;
  count: number;
  at: number;
  /** Counts the times Find was asked for: each one brings the keyboard back to the field. */
  asked: number;
  onQuery: (query: string) => void;
  onMove: (by: number) => void;
  onClose: () => void;
}) {
  const field = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `asked` is what asks for the keyboard.
  useEffect(() => field.current?.querySelector("input")?.focus(), [asked]);
  return (
    <search
      ref={field}
      className="mac-news-find"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        } else if (event.key === "Enter") {
          event.preventDefault();
          onMove(event.shiftKey ? -1 : 1);
        }
      }}
    >
      <SearchField aria-label="Find in Story" value={query} onValueChange={onQuery} />
      <span className="mac-news-find-count" role="status">
        {query.trim() === "" ? "" : count === 0 ? "Not Found" : `${at + 1} of ${count}`}
      </span>
      <PushButton size="small" disabled={count === 0} onClick={() => onMove(-1)}>
        Previous
      </PushButton>
      <PushButton size="small" disabled={count === 0} onClick={() => onMove(1)}>
        Next
      </PushButton>
      <PushButton size="small" onClick={onClose}>
        Done
      </PushButton>
    </search>
  );
}

/** A story, opened: its article when its page can be read, else what its feed says of it. */
function LiveReader({ story, now, saved, textScale, onToggleSaved, showFind }: ReaderProps) {
  const headline = useRef<HTMLHeadingElement>(null);
  const article = useRef<HTMLElement>(null);
  const read = useStoryArticle(story.link, story.publisher);
  const [opened, setOpened] = useState<"safari" | "none">();
  const [find, setFind] = useState<{ query: string; at: number } | null>(null);
  const [findAsked, setFindAsked] = useState(0);
  useEffect(() => headline.current?.focus(), []);
  useEffect(() => {
    showFind.current = () => {
      setFind((current) => current ?? { query: "", at: 0 });
      setFindAsked((asked) => asked + 1);
    };
    return () => {
      showFind.current = null;
    };
  }, [showFind]);
  useEffect(() => {
    if (find) article.current?.querySelector("[data-current]")?.scrollIntoView({ block: "center" });
  }, [find]);
  const text = summaryParagraphs(story);
  const blocks = read.status === "ready" ? read.blocks : null;
  const author = "author" in story ? story.author : undefined;
  const noSummary = `${story.publisher} gives no summary of this story in its feed.`;
  const query = find?.query ?? "";
  const matches = [
    story.title,
    ...(blocks ? blocks.map((block) => block.text) : text.length > 0 ? text : [noSummary]),
  ]
    .flatMap((each) => findParts(each, query))
    .filter((part) => part.match).length;
  let seen = 0;
  const marked = (value: string) =>
    findParts(value, query).map((part) => {
      if (!part.match) return part.text;
      const place = seen++;
      return (
        <mark
          key={place}
          className="mac-news-find-match"
          data-current={place === find?.at ? "" : undefined}
        >
          {part.text}
        </mark>
      );
    });
  return (
    <article
      ref={article}
      className="mac-news-column"
      data-view="reader"
      style={{ zoom: textScale }}
    >
      {find ? (
        <FindBar
          asked={findAsked}
          query={find.query}
          count={matches}
          at={find.at}
          onQuery={(next) => setFind({ query: next, at: 0 })}
          onMove={(by) =>
            setFind((current) =>
              current && matches > 0
                ? { ...current, at: (current.at + by + matches) % matches }
                : current,
            )
          }
          onClose={() => {
            setFind(null);
            headline.current?.focus();
          }}
        />
      ) : null}
      <span className="mac-news-story-publisher">{story.publisher}</span>
      <h2 ref={headline} tabIndex={-1} className="mac-news-title">
        {marked(story.title)}
      </h2>
      <span className="mac-news-story-age">
        {[ageOf(story.published, now), author ? `By ${author}` : ""].filter(Boolean).join(" · ")}
      </span>
      {story.image ? (
        <span className="mac-news-story-art">
          <StoryPicture id={liveKey(story)} src={story.image} />
        </span>
      ) : null}
      {blocks ? (
        blocks.map((block) =>
          block.kind === "h" ? (
            <h3 key={block.id} className="mac-news-article-heading">
              {marked(block.text)}
            </h3>
          ) : block.kind === "pre" ? (
            <pre key={block.id} className="mac-news-article-code">
              {marked(block.text)}
            </pre>
          ) : (
            <p key={block.id} className="mac-news-paragraph">
              {marked(block.text)}
            </p>
          ),
        )
      ) : text.length > 0 ? (
        text.map((paragraph) => (
          <p key={paragraph} className="mac-news-paragraph">
            {marked(paragraph)}
          </p>
        ))
      ) : (
        <p className="mac-news-paragraph">{marked(noSummary)}</p>
      )}
      <p className="mac-news-status" role="status" data-article={read.status}>
        {read.status === "reading"
          ? `Reading the story at ${story.publisher}…`
          : read.status === "none"
            ? read.reason
            : ""}
      </p>
      <div className="mac-news-actions">
        {story.link ? (
          <PushButton
            variant="primary"
            onClick={() => story.link && setOpened(openStoryLink(story.link))}
          >
            Read Full Story
          </PushButton>
        ) : null}
        <PushButton onClick={onToggleSaved}>
          {saved ? "Remove from Saved" : "Save Story"}
        </PushButton>
      </div>
      <p className="mac-news-status" role="status">
        {opened === "safari"
          ? `Opened at ${story.publisher} in Safari.`
          : opened === "none"
            ? `This story’s link is not a web address Safari can open.`
            : ""}
      </p>
    </article>
  );
}

/** Today: the masthead with today's date, then the newest stories of the channels followed. */
function LiveToday({
  stories,
  suggested,
  status,
  onOpen,
  onMore,
  now,
  menu,
  linkOf,
}: {
  stories: readonly NewsStory[];
  suggested: readonly NewsStory[];
  status: ReactNode;
  onOpen: (story: NewsStory) => void;
  onMore: () => void;
  now: number;
  menu: StoryProps["menu"];
  linkOf: StoryProps["linkOf"];
}) {
  const id = useId();
  const suggestedId = useId();
  return (
    <div className="mac-news-section">
      <div className="mac-news-column">
        <h2 className="mac-news-masthead">
          <NewsMark />
          News <span className="mac-news-masthead-date">{mastheadDate(now)}</span>
        </h2>
        <h3 id={id} className="mac-news-section-title">
          Top Stories
        </h3>
        {status}
        {stories.length === 0 ? (
          <EmptyState className="mac-news-empty">No Stories Yet</EmptyState>
        ) : (
          <>
            <CardGrid aria-labelledby={id} columns={2} gap={22} style={STORY_GRID}>
              {stories.slice(0, 2).map((story) => (
                <Story
                  key={story.id}
                  story={story}
                  layout="lead"
                  level={4}
                  onOpen={onOpen}
                  menu={menu}
                  linkOf={linkOf}
                />
              ))}
            </CardGrid>
            <div className="mac-news-secondary">
              <CardGrid
                aria-label="More of the top stories"
                columns={3}
                gap={22}
                style={STORY_GRID}
              >
                {stories.slice(2, 5).map((story) => (
                  <Story
                    key={story.id}
                    story={story}
                    layout="beside"
                    level={4}
                    onOpen={onOpen}
                    menu={menu}
                    linkOf={linkOf}
                  />
                ))}
              </CardGrid>
            </div>
            <div className="mac-news-more-row">
              <button type="button" className="mac-news-more" onClick={onMore}>
                More <span className="mac-news-more-tint">Top Stories</span>
              </button>
            </div>
          </>
        )}
        {suggested.length > 0 ? (
          <div className="mac-news-suggested">
            <h3 id={suggestedId} className="mac-news-section-title">
              Suggested For You
            </h3>
            <p className="mac-news-status">From channels you do not follow.</p>
            <CardGrid aria-labelledby={suggestedId} columns={3} gap={22} style={STORY_GRID}>
              {suggested.map((story) => (
                <Story
                  key={story.id}
                  story={story}
                  layout="beside"
                  level={4}
                  onOpen={onOpen}
                  menu={menu}
                  linkOf={linkOf}
                />
              ))}
            </CardGrid>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * News with real stories, as the desktop's Ferrite application serves it: publishers' feeds read
 * by the server through its declared egress (`ferrite-apps/desktop/src/apps/news`), and the
 * person's channels, blocked channels, Saved Stories and History kept for them on the server.
 * The window, its toolbar and its sidebar are the demo's; the content is live.
 */
export function LiveNews({
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 1222,
  height = 842,
  className,
  edition: _edition,
  ...windowProps
}: NewsProps) {
  const news = useLiveNews(true);
  const { catalogue, library, setLibrary, feeds, want, reload } = news;
  const kept = useDesktopValue(NEWS_VIEW, readNewsKept, NO_KEPT);
  const keep = (change: NewsKept) => changeDesktopValue(NEWS_VIEW, { ...kept, ...change });
  // What this window has chosen; until then, what the person last chose, while it still exists.
  const [ownView, setView] = useState<View | null>(null);
  const wantedView = ownView ?? kept.view ?? TODAY;
  const view =
    !catalogue ||
    !("id" in wantedView) ||
    (wantedView.kind === "channel" ? catalogue.channels : catalogue.topics).some(
      (entry) => entry.id === wantedView.id,
    )
      ? wantedView
      : TODAY;
  const [story, setStory] = useState<Openable>();
  const [query, setQuery] = useState("");
  // The stories chosen in Saved Stories or History.
  const [pick, setPick] = useState<StoryChoice | null>(null);
  const [ownSidebar, setSidebar] = useState<boolean | null>(null);
  const sidebar = ownSidebar ?? !kept.sidebarHidden;
  const toggleSidebar = () => {
    setSidebar(!sidebar);
    keep({ sidebarHidden: sidebar });
  };
  const [textScale, setTextScale] = useDesktopSetting(NEWS_TEXT_SCALE, readTextScale, 1);
  const [hiddenTopics, setHiddenTopics] = useDesktopSetting(
    NEWS_HIDDEN_TOPICS,
    readTopicIds,
    NO_TOPICS,
  );
  const [now, setNow] = useState(() => Date.now());
  const pane = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLDivElement>(null);
  const showFind = useRef<(() => void) | null>(null);
  const [chrome, setChrome] = useState<HTMLDivElement | null>(null);

  const channels = catalogue?.channels ?? [];
  const channelName = (id: string) => channels.find((channel) => channel.id === id)?.name ?? id;
  const blockedPublishers = useMemo(
    () =>
      new Set(
        (catalogue?.channels ?? [])
          .filter((channel) => library.blocked.includes(channel.id))
          .map((channel) => channel.name),
      ),
    [catalogue, library.blocked],
  );
  const following = useMemo(
    () =>
      library.following.filter(
        (id) =>
          !library.blocked.includes(id) &&
          (!catalogue || catalogue.channels.some((channel) => channel.id === id)),
      ),
    [library.following, library.blocked, catalogue],
  );

  const viewSources = sourcesOf(view, following, catalogue);
  const searching = query.trim() !== "";
  const suggestedSources = useMemo(
    () =>
      view.kind === "today" && !searching
        ? (catalogue?.channels ?? [])
            .map((channel) => channel.id)
            .filter((id) => !library.following.includes(id) && !library.blocked.includes(id))
            .slice(0, SUGGESTED_CHANNELS)
        : [],
    [view.kind, searching, catalogue, library.following, library.blocked],
  );
  // A search looks through every feed the window has read.
  const wanted = searching ? Object.keys(feeds) : [...viewSources, ...suggestedSources];
  const wantedKey = wanted.join(",");

  // Read the feeds the view shows, and again on a timer while the window stays open: `want`
  // reads a feed again once it is older than the server keeps one.
  useEffect(() => {
    if (!catalogue || wantedKey === "") return;
    const sources = wantedKey.split(",");
    want(sources);
    const timer = setInterval(() => want(sources), 60_000);
    return () => clearInterval(timer);
  }, [catalogue, wantedKey, want]);
  // Ages ("5m ago") move on while the window is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const storiesOf = (sources: readonly string[], keepBlocked = false) =>
    mergeStories(
      sources.map((source) => feeds[source]?.feed?.stories ?? []),
      keepBlocked ? new Set() : blockedPublishers,
    );
  const all = useMemo(
    () =>
      mergeStories(
        Object.values(feeds).map((state) => state.feed?.stories ?? []),
        blockedPublishers,
      ),
    [feeds, blockedPublishers],
  );
  /** A listed story's card, and what opening it opens. */
  const byKey = new Map<string, Openable>();
  const cards = (list: readonly Openable[]) =>
    list.map((item) => {
      // The feed's copy has the summary; a kept one is used when the feed has moved on.
      const fresh = all.find((candidate) => liveKey(candidate) === liveKey(item)) ?? item;
      byKey.set(liveKey(item), fresh);
      return toNewsStory(fresh, now);
    });

  const open = (card: NewsStory) => {
    const chosen = byKey.get(card.id);
    if (!chosen) return;
    setPick(null);
    setStory(chosen);
    setLibrary((before: NewsLibrary) => ({
      ...before,
      history: withVisit(before.history, chosen),
    }));
  };
  // A saved story asked for from Spotlight, once the library that holds it has been read.
  const [askedStory, setAskedStory] = useState<string | null>(null);
  useOpenItemRequests("news", ({ id }) => setAskedStory(id));
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new request or library opens it.
  useEffect(() => {
    const found = library.saved.find((each) => each.id === askedStory);
    if (!found) return;
    setAskedStory(null);
    setPick(null);
    setStory(found);
    setLibrary((before: NewsLibrary) => ({
      ...before,
      history: withVisit(before.history, found),
    }));
  }, [askedStory, library.saved]);
  const choose = (next: View) => {
    setPick(null);
    setView(next);
    keep({ view: next });
    setStory(undefined);
    setQuery("");
  };
  const isSaved = story ? library.saved.some((other) => liveKey(other) === liveKey(story)) : false;
  const [notice, setNotice] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: what it said was about the place left
  useEffect(() => setNotice(null), [story, view]);
  const saveOrRemove = (target: Openable) => {
    const full = savedIsFull(library.saved, target);
    setNotice(
      full ? `Saved Stories keeps at most ${MAX_SAVED} stories. Remove one to save another.` : null,
    );
    if (full) return;
    setLibrary((before: NewsLibrary) => ({
      ...before,
      saved: toggleSaved(before.saved, target),
    }));
  };
  const toggleStorySaved = () => {
    if (story) saveOrRemove(story);
  };
  const removeFromHistory = (key: string) =>
    setLibrary((before: NewsLibrary) => ({
      ...before,
      history: withoutStory(before.history, key),
    }));
  const follow = (id: string) =>
    setLibrary((before: NewsLibrary) => ({ ...before, following: toggle(before.following, id) }));
  const block = (id: string) =>
    setLibrary((before: NewsLibrary) => ({
      ...before,
      blocked: toggle(before.blocked, id),
      // A channel blocked is no longer followed.
      following: before.blocked.includes(id)
        ? before.following
        : before.following.filter((other) => other !== id),
    }));

  /** The list stories can be chosen in, as shown now, and which of them are chosen. */
  const choosing = !story && !searching && (view.kind === "saved" || view.kind === "history");
  const choosable = !choosing
    ? []
    : (view.kind === "saved" ? library.saved : library.history).map(liveKey);
  const picked = choosable.filter((key) => pick?.ids.includes(key));
  const removePicked = () => {
    const field = view.kind === "saved" ? "saved" : "history";
    setLibrary((before: NewsLibrary) => ({
      ...before,
      [field]: before[field].filter((other) => !picked.includes(liveKey(other))),
    }));
    setPick(null);
  };
  const pickAll = () =>
    setPick((now) => ({ ids: choosable, anchor: now?.anchor ?? choosable[0] ?? "" }));
  const linkOfCard = (card: NewsStory) => {
    const link = byKey.get(card.id)?.link;
    return link ? (linkAddress(link) ?? undefined) : undefined;
  };

  /** The rows of a listed story's contextual menu. */
  const storyMenu = (card: NewsStory) => {
    if (picked.length > 1 && picked.includes(card.id)) {
      return (
        <MenuItem onClick={removePicked}>
          Remove {picked.length} from {view.kind === "saved" ? "Saved Stories" : "History"}
        </MenuItem>
      );
    }
    const chosen = byKey.get(card.id);
    if (!chosen) return null;
    const address = chosen.link ? linkAddress(chosen.link) : null;
    const saved = library.saved.some((other) => liveKey(other) === card.id);
    return (
      <>
        <MenuItem onClick={() => open(card)}>Open Story</MenuItem>
        <MenuItem
          disabled={address === null}
          title={address === null ? NO_ADDRESS_REASON : undefined}
          onClick={() => {
            if (address) openStoryLink(address);
          }}
        >
          Open in Safari
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => saveOrRemove(chosen)}>
          {saved ? "Remove from Saved Stories" : "Save Story"}
        </MenuItem>
        {view.kind === "history" && !searching ? (
          <MenuItem onClick={() => removeFromHistory(card.id)}>Remove from History</MenuItem>
        ) : null}
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>Share</SubmenuTrigger>
          <SubmenuPopup>
            <LinkShareItems plain url={chosen.link ?? ""} title={chosen.title} from="news" />
          </SubmenuPopup>
        </Submenu>
        <MenuItem
          disabled={address === null}
          title={address === null ? NO_ADDRESS_REASON : undefined}
          onClick={() => {
            if (address) void copyText(address);
          }}
        >
          Copy Link
        </MenuItem>
      </>
    );
  };
  /** The rows of a channel's contextual menu, in the sidebar and in Discover Channels. */
  const channelMenu = (channel: LiveChannel) => {
    const followed = library.following.includes(channel.id);
    const blocked = library.blocked.includes(channel.id);
    const at = following.indexOf(channel.id);
    const moveTo = (before: string | null) =>
      setLibrary((now: NewsLibrary) => ({
        ...now,
        following: movedBefore(now.following, channel.id, before),
      }));
    return (
      <>
        <MenuItem onClick={() => choose({ kind: "channel", id: channel.id })}>
          Open Channel
        </MenuItem>
        {at >= 0 ? (
          <>
            <MenuSeparator />
            <MenuItem disabled={at === 0} onClick={() => moveTo(following[at - 1] ?? null)}>
              Move Up
            </MenuItem>
            <MenuItem
              disabled={at === following.length - 1}
              onClick={() => moveTo(following[at + 2] ?? null)}
            >
              Move Down
            </MenuItem>
          </>
        ) : null}
        <MenuSeparator />
        <MenuItem
          disabled={blocked}
          title={blocked ? "Unblock this channel to follow it." : undefined}
          onClick={() => follow(channel.id)}
        >
          {followed ? "Unfollow Channel" : "Follow Channel"}
        </MenuItem>
        <MenuItem onClick={() => block(channel.id)}>
          {blocked ? "Unblock Channel" : "Block Channel"}
        </MenuItem>
      </>
    );
  };
  /** `row` with a contextual menu of `rows`, named `label`. */
  const withMenu = (label: string, rows: ReactNode, row: ReactNode) => (
    <ContextualMenu>
      <ContextualMenuTrigger className="mac-news-row-menu">{row}</ContextualMenuTrigger>
      <ContextualMenuPopup aria-label={label}>{rows}</ContextualMenuPopup>
    </ContextualMenu>
  );

  const status = (sources: readonly string[]) => (
    <Status
      states={sources.map((source) => feeds[source])}
      names={sources.map((source) => {
        const first = feeds[source]?.feed?.stories[0];
        return first?.publisher ?? channelName(source);
      })}
      now={now}
    />
  );

  let content: ReactNode;
  if (!catalogue) {
    content = (
      <div className="mac-news-column" data-view="list">
        <EmptyState className="mac-news-empty">
          {news.catalogueFailed ? "News Is Not Available" : "Loading…"}
        </EmptyState>
        {news.catalogueFailed ? (
          <div className="mac-news-actions">
            <PushButton onClick={news.retryCatalogue}>Try Again</PushButton>
          </div>
        ) : null}
      </div>
    );
  } else if (story) {
    content = (
      <LiveReader
        key={liveKey(story)}
        story={story}
        now={now}
        saved={isSaved}
        textScale={textScale}
        onToggleSaved={toggleStorySaved}
        showFind={showFind}
      />
    );
  } else if (searching) {
    content = (
      <StoryList
        title="Search Results"
        stories={cards(all.filter((candidate) => liveMatches(candidate, query)))}
        empty="No Results"
        onOpen={open}
        menu={storyMenu}
        linkOf={linkOfCard}
      />
    );
  } else if (view.kind === "today") {
    content = (
      <LiveToday
        stories={cards(topStories(storiesOf(viewSources), 5))}
        suggested={cards(topStories(storiesOf(suggestedSources), SUGGESTED_STORIES))}
        status={status(viewSources)}
        onOpen={open}
        onMore={() => choose({ kind: "top" })}
        now={now}
        menu={storyMenu}
        linkOf={linkOfCard}
      />
    );
  } else if (view.kind === "top") {
    content = (
      <StoryList
        title="Top Stories"
        header={status(viewSources)}
        stories={cards(storiesOf(viewSources))}
        empty="Follow a channel to see its stories here."
        focusTitle
        onOpen={open}
        menu={storyMenu}
        linkOf={linkOfCard}
      />
    );
  } else if (view.kind === "saved" || view.kind === "history") {
    content = (
      <StoryList
        title={view.kind === "saved" ? "Saved Stories" : "History"}
        stories={cards(view.kind === "saved" ? library.saved : library.history)}
        empty={view.kind === "saved" ? "No Saved Stories" : "No History"}
        header={
          view.kind === "history" && library.history.length > 0 ? (
            <div className="mac-news-actions">
              <PushButton
                onClick={() => setLibrary((before: NewsLibrary) => ({ ...before, history: [] }))}
              >
                Clear History
              </PushButton>
            </div>
          ) : null
        }
        onOpen={open}
        menu={storyMenu}
        linkOf={linkOfCard}
        picked={picked}
        onPick={(card, range) => setPick((now) => choiceAfter(now, choosable, card.id, range))}
      />
    );
  } else if (view.kind === "discover") {
    content = (
      <div className="mac-news-column" data-view="list">
        <h2 className="mac-news-title">Discover Channels</h2>
        <ul className="mac-news-discover" aria-label="Channels">
          {catalogue.channels.map((channel) => {
            const followed = library.following.includes(channel.id);
            const blocked = library.blocked.includes(channel.id);
            return (
              <li key={channel.id} className="mac-news-discover-row">
                {withMenu(
                  "Channel",
                  channelMenu(channel),
                  <>
                    <ChannelIcon tint={channel.tint} initial={channel.name.charAt(0)} />
                    <button
                      type="button"
                      className="mac-news-discover-name"
                      onClick={() => choose({ kind: "channel", id: channel.id })}
                    >
                      {channel.name}
                    </button>
                    <PushButton
                      size="small"
                      aria-pressed={followed}
                      aria-label={`${followed ? "Unfollow" : "Follow"} ${channel.name}`}
                      disabled={blocked}
                      onClick={() => follow(channel.id)}
                    >
                      {followed ? "Following" : "Follow"}
                    </PushButton>
                    <PushButton
                      size="small"
                      aria-label={`${blocked ? "Unblock" : "Block"} ${channel.name}`}
                      onClick={() => block(channel.id)}
                    >
                      {blocked ? "Unblock" : "Block"}
                    </PushButton>
                  </>,
                )}
              </li>
            );
          })}
        </ul>
        <h2 className="mac-news-title">Topics</h2>
        <ul className="mac-news-discover" aria-label="Topics">
          {catalogue.topics.map((topic) => {
            const followed = !hiddenTopics.includes(topic.id);
            return (
              <li key={topic.id} className="mac-news-discover-row">
                <ChannelIcon tint={topic.tint} initial={topic.name.charAt(0)} />
                <button
                  type="button"
                  className="mac-news-discover-name"
                  onClick={() => choose({ kind: "topic", id: topic.id })}
                >
                  {topic.name}
                </button>
                <PushButton
                  size="small"
                  aria-pressed={followed}
                  aria-label={`${followed ? "Unfollow" : "Follow"} ${topic.name}`}
                  onClick={() => setHiddenTopics(toggle(hiddenTopics, topic.id))}
                >
                  {followed ? "Following" : "Follow"}
                </PushButton>
              </li>
            );
          })}
        </ul>
      </div>
    );
  } else if (view.kind === "channel" || view.kind === "topic") {
    const { id } = view;
    const isChannel = view.kind === "channel";
    const topic = catalogue.topics.find((candidate) => candidate.id === id);
    const name = isChannel ? channelName(id) : (topic?.name ?? id);
    const followed = library.following.includes(id);
    const blocked = isChannel && library.blocked.includes(id);
    content = (
      <StoryList
        key={viewId(view)}
        title={name}
        header={
          <>
            {isChannel ? (
              <div className="mac-news-actions">
                <PushButton aria-pressed={followed} disabled={blocked} onClick={() => follow(id)}>
                  {followed ? "Unfollow" : "Follow"}
                </PushButton>
                <PushButton onClick={() => block(id)}>
                  {blocked ? "Unblock Channel" : "Block Channel"}
                </PushButton>
              </div>
            ) : null}
            {status(viewSources)}
          </>
        }
        stories={blocked ? [] : cards(storiesOf(viewSources))}
        empty={blocked ? "You blocked this channel." : "No Stories"}
        onOpen={open}
        menu={storyMenu}
        linkOf={linkOfCard}
      />
    );
  }

  const selected = viewId(view);
  // A story dragged from this window is on its way somewhere else, not asking for its channel.
  const ownDrag = useRef(false);
  // The channel being dragged in the sidebar, and where it would land.
  const draggedChannel = useRef<string | null>(null);
  const [channelDrop, setChannelDrop] = useState<{ id: string; place: "before" | "after" } | null>(
    null,
  );
  const channelRow = (id: string) => ({
    draggable: true,
    "data-drop": channelDrop?.id === id ? channelDrop.place : undefined,
    onDragStart: (event: DragEvent<HTMLDivElement>) => {
      draggedChannel.current = id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", channelName(id));
    },
    onDragEnd: () => {
      draggedChannel.current = null;
      setChannelDrop(null);
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      // Only this sidebar's own rows land here.
      if (!draggedChannel.current) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const box = event.currentTarget.getBoundingClientRect();
      setChannelDrop({ id, place: event.clientY < box.top + box.height / 2 ? "before" : "after" });
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      const moved = draggedChannel.current;
      if (!moved || !channelDrop) return;
      event.preventDefault();
      const next = following[following.indexOf(id) + 1];
      const before = channelDrop.place === "before" ? id : (next ?? null);
      setChannelDrop(null);
      if (before !== moved) {
        setLibrary((now: NewsLibrary) => ({
          ...now,
          following: movedBefore(now.following, moved, before),
        }));
      }
    },
  });
  /** The arrow keys move between the stories listed, unless a field or the sidebar has them. */
  const onWindowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    windowProps.onKeyDown?.(event);
    const key = event.key;
    if (choosing && !event.defaultPrevented) {
      const inField = (event.target as Element).closest("input, textarea, [contenteditable]");
      if (!inField && (event.metaKey || event.ctrlKey) && key.toLowerCase() === "a") {
        if (choosable.length > 0) {
          event.preventDefault();
          pickAll();
        }
        return;
      }
      if (!inField && picked.length > 0 && key === "Escape") {
        event.preventDefault();
        setPick(null);
        return;
      }
      if (!inField && picked.length > 0 && (key === "Backspace" || key === "Delete")) {
        event.preventDefault();
        removePicked();
        return;
      }
    }
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      (key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight")
    ) {
      return;
    }
    const target = event.target as Element;
    if (story || target.closest("input, textarea, [contenteditable], [role='slider']")) return;
    const links = [...(pane.current?.querySelectorAll<HTMLElement>(".mac-news-story-link") ?? [])];
    if (!pane.current?.contains(target) || links.length === 0) return;
    const from = links.indexOf(target as HTMLElement);
    const places = links.map((link) => {
      const box = link.closest(".mac-news-story")?.getBoundingClientRect();
      return {
        x: (box?.left ?? 0) + (box?.width ?? 0) / 2,
        y: (box?.top ?? 0) + (box?.height ?? 0) / 2,
      };
    });
    const next = from < 0 ? 0 : storyToward(places, from, key);
    if (next !== undefined) {
      event.preventDefault();
      links[next]?.focus();
    }
  };
  const item = (id: string, label: string, tint: string, next: View) => (
    <CatalystSidebarItem
      icon={<ChannelIcon tint={tint} initial={label.charAt(0)} />}
      selected={!searching && id === selected}
      onClick={() => choose(next)}
    >
      {label}
    </CatalystSidebarItem>
  );
  const red = "#f0364e";

  const menuChannel = story
    ? channelOf(story, channels)
    : view.kind === "channel"
      ? channels.find((channel) => channel.id === view.id)
      : undefined;
  useNewsMenus({
    within: chrome,
    textScale,
    setTextScale,
    isKey: (windowProps.state ?? "key") === "key",
    ready: !news.loading && catalogue !== undefined,
    unavailable: news.catalogueFailed,
    story,
    saved: isSaved,
    channel: menuChannel,
    followed: menuChannel !== undefined && library.following.includes(menuChannel.id),
    blocked: menuChannel !== undefined && library.blocked.includes(menuChannel.id),
    sidebarShown: sidebar,
    canReload: wanted.length > 0,
    canPickAll: choosable.length > 0,
    say: setNotice,
    pickAll: () => {
      pickAll();
      // The menu holds the keyboard until it has faded out; Escape and Delete then act on the list.
      setTimeout(
        () => pane.current?.querySelector<HTMLElement>(".mac-news-story-link")?.focus(),
        300,
      );
    },
    toggleSidebar,
    back: () => setStory(undefined),
    today: () => choose({ kind: "today" }),
    reload: () => {
      reload(wanted);
      setNow(Date.now());
    },
    toggleSaved: toggleStorySaved,
    openInSafari: openStoryLink,
    toggleFollowed: follow,
    toggleBlocked: block,
    focusSearch: () => search.current?.querySelector("input")?.focus(),
    findInStory: () => showFind.current?.(),
  });

  return (
    <Window
      {...windowProps}
      onDragStartCapture={() => {
        ownDrag.current = true;
      }}
      onDragEndCapture={() => {
        ownDrag.current = false;
      }}
      onDragOver={(event) => {
        if (ownDrag.current || !event.dataTransfer.types.includes("text/uri-list")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "link";
      }}
      onDrop={(event) => {
        if (ownDrag.current) return;
        const address = event.dataTransfer.getData("text/uri-list").split(/\r?\n/)[0];
        if (!address) return;
        event.preventDefault();
        const found = channelOfAddress(address, channels);
        if (found) choose({ kind: "channel", id: found.id });
        else setNotice(`No channel here publishes from ${address}.`);
      }}
      onKeyDown={onWindowKeyDown}
      width={width}
      height={height}
      className={className ? `mac-news ${className}` : "mac-news"}
      data-live=""
      // Busy until the channel list has arrived too (or failed): the sidebar's channels and the
      // stories are not there before it. Inert only while the library loads, so that nothing is
      // changed that its load would replace.
      aria-busy={news.loading || (!catalogue && !news.catalogueFailed) || undefined}
      inert={news.loading || undefined}
    >
      <CatalystChrome
        ref={setChrome}
        title="News"
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        toolbar={
          <Toolbar aria-label="News toolbar">
            <ToolbarButton
              aria-label="Back"
              disabled={!story}
              style={TOOLBAR_BUTTON}
              onClick={() => setStory(undefined)}
            >
              <SystemImage name="go-back" />
            </ToolbarButton>
            <ToolbarButton
              aria-label={sidebar ? "Hide Sidebar" : "Show Sidebar"}
              style={TOOLBAR_BUTTON}
              onClick={toggleSidebar}
            >
              <SystemImage name="sidebar" />
            </ToolbarButton>
            <ToolbarSpace />
            <Menu>
              <MenuTrigger
                disabled={!story}
                render={
                  <ToolbarButton aria-label="Share" style={TOOLBAR_BUTTON}>
                    <SystemImage name="share" />
                  </ToolbarButton>
                }
              />
              <MenuPopup align="end" sideOffset={4}>
                <MenuItem
                  disabled={!story?.link}
                  onClick={() => story?.link && openStoryLink(story.link)}
                >
                  Open in Safari
                </MenuItem>
                <LinkShareItems
                  plain
                  url={story?.link ?? ""}
                  title={story?.title ?? ""}
                  from="news"
                />
                <MenuItem onClick={toggleStorySaved}>
                  {isSaved ? "Remove from Saved Stories" : "Save Story"}
                </MenuItem>
              </MenuPopup>
            </Menu>
            <ToolbarSearchField
              ref={search}
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                if (value.trim() !== "") setStory(undefined);
              }}
              style={SEARCH_FIELD}
            />
          </Toolbar>
        }
        sidebar={
          sidebar ? (
            <CatalystSidebar aria-label="Channels" style={SIDEBAR}>
              <CatalystSidebarGroup title="News">
                {item("today", "Today", red, { kind: "today" })}
                {item("saved", "Saved Stories", red, { kind: "saved" })}
                {item("history", "History", red, { kind: "history" })}
              </CatalystSidebarGroup>
              <CatalystSidebarGroup title="Following">
                {following.map((id) => {
                  const channel = channels.find((candidate) => candidate.id === id);
                  return channel ? (
                    <div key={id} className="mac-news-channel-row" {...channelRow(id)}>
                      {withMenu(
                        "Channel",
                        channelMenu(channel),
                        item(`channel:${id}`, channel.name, channel.tint, { kind: "channel", id }),
                      )}
                    </div>
                  ) : null;
                })}
                {item("discover", "Discover Channels", "#7d5fb8", { kind: "discover" })}
              </CatalystSidebarGroup>
              <CatalystSidebarGroup title="Topics">
                {(catalogue?.topics ?? [])
                  .filter((topic) => !hiddenTopics.includes(topic.id))
                  .map((topic) => (
                    <Fragment key={topic.id}>
                      {withMenu(
                        "Topic",
                        <>
                          <MenuItem onClick={() => choose({ kind: "topic", id: topic.id })}>
                            Open Topic
                          </MenuItem>
                          <MenuItem onClick={() => reload(topic.sources)}>Reload Topic</MenuItem>
                          <MenuSeparator />
                          <MenuItem
                            onClick={() => {
                              setHiddenTopics([...hiddenTopics, topic.id]);
                              if (view.kind === "topic" && view.id === topic.id) {
                                choose({ kind: "today" });
                              }
                            }}
                          >
                            Unfollow Topic
                          </MenuItem>
                          <MenuItem disabled title={NO_TOPIC_BLOCK}>
                            Block Topic
                          </MenuItem>
                        </>,
                        item(`topic:${topic.id}`, topic.name, topic.tint, {
                          kind: "topic",
                          id: topic.id,
                        }),
                      )}
                    </Fragment>
                  ))}
              </CatalystSidebarGroup>
            </CatalystSidebar>
          ) : null
        }
      >
        <div
          key={story ? `story-${liveKey(story)}` : viewId(view)}
          ref={pane}
          className="mac-news-pane"
        >
          {notice ? (
            <p className="mac-news-status" role="status">
              {notice}
            </p>
          ) : null}
          {content}
        </div>
      </CatalystChrome>
    </Window>
  );
}
