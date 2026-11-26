"use client";

import { CardGrid } from "macalicious/card-grid";
import {
  CatalystChrome,
  type CatalystChromeProps,
  CatalystSidebar,
  CatalystSidebarGroup,
  CatalystSidebarItem,
} from "macalicious/catalyst-chrome";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem } from "macalicious/menu-item";
import { SystemImage } from "macalicious/system-image";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { copyText } from "../desktop/desktop-share-link";
import { ChannelIcon, NewsMark, PlayMark, StoryPicture } from "./news-artwork";
import {
  allStories,
  CHANNELS,
  GROUPS,
  lightEdition,
  matchesQuery,
  type NewsEdition,
  type NewsStory,
  paragraphs,
  storiesOf,
  storyKey,
} from "./news-data";
import { LiveNews } from "./news-live-window";
import { STORY_GRID, Story, StoryList } from "./news-stories";
import "./news.tokens.css";
import "./news.css";

/** Measured: the three toolbar buttons are 39 pt wide. */
const TOOLBAR_BUTTON: CSSProperties = { width: 39 };
/** Measured: the search field is 161 pt wide. */
const SEARCH_FIELD: CSSProperties = { width: 161 };
/**
 * Measured: the sidebar is 227 pt wide in the Aqua capture and 234 pt in the Dark Aqua one, as
 * the library's own example of this window has it.
 */
const SIDEBAR = {
  "--mac-catalyst-chrome-sidebar-width": "calc(227px + 7px * var(--mac-appearance-dark))",
} as CSSProperties;

/** What the three destinations without stories of their own say while they are empty. */
const EMPTY: Readonly<Record<string, string>> = {
  "news-plus": "No Issues",
  saved: "No Saved Stories",
  history: "No History",
};

export interface NewsProps extends Omit<WindowProps, "children"> {
  /**
   * The day the app shows: the date under the masthead and the top stories. The default is the
   * edition of the Aqua capture; `darkEdition` in `news-data.ts` is the Dark Aqua capture's.
   */
  edition?: NewsEdition;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /**
   * For the toolbar row, which is this window's drag region: called when the primary pointer
   * button goes down on the bar itself, not on a control in it. A window manager starts moving
   * the window here.
   */
  onDragRegionPointerDown?: CatalystChromeProps["onDragRegionPointerDown"];
  /** For the toolbar row: called when the bar itself is double-clicked. */
  onDragRegionDoubleClick?: CatalystChromeProps["onDragRegionDoubleClick"];
}

interface TodayProps {
  edition: NewsEdition;
  onOpen: (story: NewsStory) => void;
  /** Shows the News Top Stories channel. */
  onMore: () => void;
}

/** Today: the masthead with the date, then Top Stories: two leads and three smaller stories. */
function Today({ edition, onOpen, onMore }: TodayProps) {
  const id = useId();
  return (
    <div className="mac-news-section">
      <div className="mac-news-column">
        <h2 className="mac-news-masthead">
          <NewsMark />
          News <span className="mac-news-masthead-date">{edition.date}</span>
        </h2>
        <h3 id={id} className="mac-news-section-title">
          Top Stories
        </h3>
        <CardGrid aria-labelledby={id} columns={2} gap={22} style={STORY_GRID}>
          {edition.top.slice(0, 2).map((story) => (
            <Story key={story.id} story={story} layout="lead" level={4} onOpen={onOpen} />
          ))}
        </CardGrid>
        <div className="mac-news-secondary">
          <CardGrid aria-label="More of the top stories" columns={3} gap={22} style={STORY_GRID}>
            {edition.top.slice(2, 5).map((story) => (
              <Story key={story.id} story={story} layout="beside" level={4} onOpen={onOpen} />
            ))}
          </CardGrid>
        </div>
        <div className="mac-news-more-row">
          <button type="button" className="mac-news-more" onClick={onMore}>
            More <span className="mac-news-more-tint">Top Stories</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A story, opened: the publisher, the headline, its age, the picture and the sample text. The
 * headline takes the focus, which was on the button that opened the story and is gone with it.
 */
function Reader({ story }: { story: NewsStory }) {
  const headline = useRef<HTMLHeadingElement>(null);
  useEffect(() => headline.current?.focus(), []);
  return (
    <article className="mac-news-column" data-view="reader">
      <span className="mac-news-story-publisher">{story.publisher}</span>
      <h2 ref={headline} tabIndex={-1} className="mac-news-title">
        {story.headline}
      </h2>
      <span className="mac-news-story-age">{story.age}</span>
      <span className="mac-news-story-art">
        <StoryPicture id={story.id} />
        {story.video ? <PlayMark /> : null}
      </span>
      {paragraphs(story).map((text) => (
        <p key={text} className="mac-news-paragraph">
          {text}
        </p>
      ))}
    </article>
  );
}

/**
 * News, as in macOS 10.15 Catalina: an iPad app in a Mac window, with the channels in the
 * sidebar and, beside it, Today's top stories, a channel's stories or a story.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a page
 * or a window manager places it (`style`, `width`, `height`, `ref`) and tells it whether it is
 * key (`state`); the window controls' and the toolbar row's callbacks, the eight props a
 * managed window's `render` supplies beside the window's, are handed to those parts.
 *
 * Nothing is fetched: the stories are the `edition` it is given and the channels' own, all of
 * them invented for the demo. When the desktop is served by its Ferrite application, the window
 * is News with real stories instead (`news-live-window.tsx`): publishers' feeds read by the
 * server, the person's channels, Saved Stories and History kept for them.
 */
export function News(props: NewsProps) {
  return servedByDesktopApp() ? <LiveNews {...props} /> : <SampleNews {...props} />;
}

/** The demo's News, over the invented editions. */
function SampleNews({
  edition = lightEdition,
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
  ...windowProps
}: NewsProps) {
  const [channelId, setChannelId] = useState("today");
  // The story that is open: the record that was chosen, not its id, so that a story kept from
  // another edition is the one that opens even when the edition has a story with the same id.
  const [story, setStory] = useState<NewsStory>();
  const [query, setQuery] = useState("");
  const [sidebar, setSidebar] = useState(true);
  // The stories saved from the Share menu and the stories opened, newest first. They are kept
  // as they were, so they stay listed when the window is given another edition.
  const [saved, setSaved] = useState<readonly NewsStory[]>([]);
  const [opened, setOpened] = useState<readonly NewsStory[]>([]);
  // More Top Stories removes itself: the title of the list it leads to takes the focus.
  const [focusTitle, setFocusTitle] = useState(false);
  const pane = useRef<HTMLDivElement>(null);
  // The story to give the focus back to once the list it was opened from is shown again.
  const returnTo = useRef<string | undefined>(undefined);

  const stories = allStories(edition);
  const openKey = story ? storyKey(story) : undefined;
  const channel = CHANNELS.find((candidate) => candidate.id === channelId) ?? CHANNELS[0];
  const searching = query.trim() !== "";
  const isSaved = saved.some((candidate) => storyKey(candidate) === openKey);

  // Back: the focus returns to the headline the story was opened with, where it is listed.
  useEffect(() => {
    if (openKey !== undefined || returnTo.current === undefined) return;
    const key = returnTo.current;
    returnTo.current = undefined;
    for (const link of pane.current?.querySelectorAll<HTMLElement>("[data-story]") ?? []) {
      if (link.dataset.story === key) return link.focus();
    }
  }, [openKey]);

  // The request is for the list that More Top Stories leads to, once: a list that is shown
  // again later, after a story or a search, leaves the focus where it is.
  useEffect(() => {
    if (focusTitle) setFocusTitle(false);
  }, [focusTitle]);

  const open = (chosen: NewsStory) => {
    const key = storyKey(chosen);
    setStory(chosen);
    setOpened((before) => [chosen, ...before.filter((other) => storyKey(other) !== key)]);
  };
  const choose = (id: string, fromMore = false) => {
    setChannelId(id);
    setStory(undefined);
    setQuery("");
    setFocusTitle(fromMore);
  };

  let view = "today";
  let content = (
    <Today edition={edition} onOpen={open} onMore={() => choose("top-stories", true)} />
  );
  if (story) {
    view = `story-${openKey}`;
    content = <Reader story={story} />;
  } else if (searching) {
    view = "search";
    content = (
      <StoryList
        title="Search Results"
        stories={stories.filter((candidate) => matchesQuery(candidate, query))}
        empty="No Results"
        onOpen={open}
      />
    );
  } else if (channel && channel.id !== "today") {
    view = channel.id;
    const listed =
      channel.id === "saved"
        ? saved
        : channel.id === "history"
          ? opened
          : storiesOf(channel.id, edition);
    content = (
      <StoryList
        title={channel.name}
        stories={listed}
        empty={EMPTY[channel.id] ?? "No Stories"}
        focusTitle={focusTitle}
        onOpen={open}
      />
    );
  }

  return (
    <Window
      {...windowProps}
      width={width}
      height={height}
      className={className ? `mac-news ${className}` : "mac-news"}
    >
      <CatalystChrome
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
              onClick={() => {
                returnTo.current = openKey;
                setStory(undefined);
              }}
            >
              <SystemImage name="go-back" />
            </ToolbarButton>
            <ToolbarButton
              aria-label={sidebar ? "Hide Sidebar" : "Show Sidebar"}
              style={TOOLBAR_BUTTON}
              onClick={() => setSidebar(!sidebar)}
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
                <MenuItem onClick={() => story && void copyText(story.headline)}>
                  Copy Headline
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    if (!story) return;
                    setSaved(
                      isSaved
                        ? saved.filter((candidate) => storyKey(candidate) !== openKey)
                        : [story, ...saved],
                    );
                  }}
                >
                  {isSaved ? "Remove from Saved Stories" : "Save Story"}
                </MenuItem>
              </MenuPopup>
            </Menu>
            <ToolbarSearchField
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                // Results take the story's place as soon as there is something to look for.
                if (value.trim() !== "") setStory(undefined);
              }}
              style={SEARCH_FIELD}
            />
          </Toolbar>
        }
        sidebar={
          sidebar ? (
            <CatalystSidebar aria-label="Channels" style={SIDEBAR}>
              {GROUPS.map((group) => (
                <CatalystSidebarGroup key={group} title={group}>
                  {CHANNELS.filter((candidate) => candidate.group === group).map((candidate) => (
                    <CatalystSidebarItem
                      key={candidate.id}
                      icon={
                        <ChannelIcon tint={candidate.tint} initial={candidate.name.charAt(0)} />
                      }
                      selected={candidate.id === channel?.id}
                      onClick={() => choose(candidate.id)}
                    >
                      {candidate.name}
                    </CatalystSidebarItem>
                  ))}
                </CatalystSidebarGroup>
              ))}
            </CatalystSidebar>
          ) : null
        }
      >
        {/* A view of its own for each destination, so that each starts at its top. */}
        <div key={view} ref={pane} className="mac-news-pane">
          {content}
        </div>
      </CatalystChrome>
    </Window>
  );
}
