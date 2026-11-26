"use client";

import { CardGrid, CardGridAction, CardGridCard } from "macalicious/card-grid";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { ScrollView } from "macalicious/scroll-view";
import { StorePillButton } from "macalicious/store-pill-button";
import type { CSSProperties, HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { ProgressGlyph, ShowArtwork } from "./podcasts-artwork";
import {
  formatDuration,
  formatRemaining,
  type PodcastsEpisode,
  type PodcastsShow,
} from "./podcasts-data";

/** What the views need to know about the library and the player. */
export interface PodcastsLibrary {
  /** The show an episode belongs to. */
  showOf: (episode: PodcastsEpisode) => PodcastsShow;
  /** Seconds heard of an episode that has been started and not finished. */
  positionOf: (episode: PodcastsEpisode) => number | undefined;
  /** Whether the episode has been played to its end. */
  isPlayed: (episode: PodcastsEpisode) => boolean;
  /** The episode that is loaded in the player. */
  current: PodcastsEpisode | null;
  /** Whether the player is running. */
  playing: boolean;
  /** Loads the episode at `index` of `queue` and starts it. */
  onPlay: (queue: readonly PodcastsEpisode[], index: number) => void;
  /** Pauses or resumes the loaded episode. */
  onToggle: () => void;
  /** The rows of an episode's contextual menu; an episode has none without it. */
  episodeMenu?: (episode: PodcastsEpisode) => ReactNode;
  /** The rows of the menu on several episodes chosen together; without it, none can be chosen. */
  episodesMenu?: (episodes: readonly PodcastsEpisode[]) => ReactNode;
  /** What makes an episode's card a drag: its link for other apps, itself for Up Next. */
  dragEpisode?: (episode: PodcastsEpisode) => HTMLAttributes<HTMLElement>;
}

/** `children` with the contextual menu `items` opens on them, when there are any. */
function WithMenu({
  label,
  items,
  children,
}: {
  label: string;
  items: ReactNode;
  children: ReactNode;
}) {
  if (!items) return <>{children}</>;
  return (
    <ContextualMenu>
      <ContextualMenuTrigger className="mac-podcasts-context-menu">
        {children}
      </ContextualMenuTrigger>
      <ContextualMenuPopup aria-label={label}>{items}</ContextualMenuPopup>
    </ContextualMenu>
  );
}

/** A section's `See All` or `Back`: a button in the header's link style. */
export function SectionAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <CardGridAction render={<button type="button" />} onClick={onClick}>
      {children}
    </CardGridAction>
  );
}

/*
 * Section headers as Podcasts sets them (card-grid, Sizes): 18 pt Bold with a 15 pt action
 * (in San Francisco "Up Next" is 67.5 pt of ink and "See All" 45.5 pt, as captured), the
 * title in the label colour, the line in the grid colour, the title's cap top 17 pt and the
 * cards 48 pt under the line.
 */
const PAGE = {
  "--mac-card-grid-title": "var(--mac-color-label)",
  "--mac-card-grid-separator": "var(--mac-color-grid)",
  "--mac-card-grid-title-font":
    "var(--mac-font-weight-bold) 18px / 22px var(--mac-font-family-system)",
  "--mac-card-grid-action-font":
    "var(--mac-font-weight-regular) 15px / 18px var(--mac-font-family-system)",
  "--mac-card-grid-header-padding": "11.5px 0 13.5px",
} as CSSProperties;

/** The page of a place, a show or a search: its large title, when it has one, over `children`. */
export function PodcastsPage({ title, children }: { title: string | null; children: ReactNode }) {
  return (
    <ScrollView className="mac-podcasts-main">
      <div className="mac-podcasts-page" style={PAGE}>
        {title === null ? null : <h2 className="mac-podcasts-title">{title}</h2>}
        {children}
      </div>
    </ScrollView>
  );
}

/** A line of secondary text in a page: what an empty place holds. */
export function PodcastsNote({ children }: { children: ReactNode }) {
  return <p className="mac-podcasts-note">{children}</p>;
}

/** The caption over an episode's title: how much is left once it is started, else its day. */
function caption(episode: PodcastsEpisode, library: PodcastsLibrary): ReactNode {
  const position = library.positionOf(episode);
  if (position !== undefined && episode.duration > 0) {
    return (
      <>
        <ProgressGlyph value={position / episode.duration} />
        {formatRemaining(episode.duration - position)}
      </>
    );
  }
  return episode.isNew && !library.isPlayed(episode) ? `New · ${episode.day}` : episode.day;
}

export interface EpisodeShelfProps {
  title: string;
  episodes: readonly PodcastsEpisode[];
  library: PodcastsLibrary;
  action?: ReactNode;
  /** What the shelf takes when something is dropped on it. */
  dropProps?: HTMLAttributes<HTMLElement>;
}

/** A shelf of 252 pt episode cards, as Listen Now's Up Next: a click on a card plays it. */
export function EpisodeShelf({ title, episodes, library, action, dropProps }: EpisodeShelfProps) {
  return (
    <CardGrid
      title={title}
      action={action}
      layout="shelf"
      minCardWidth={252}
      separator
      headingLevel={3}
      {...dropProps}
    >
      {episodes.map((episode, index) => {
        const show = library.showOf(episode);
        return (
          <WithMenu key={episode.id} label={episode.title} items={library.episodeMenu?.(episode)}>
            <CardGridCard
              variant="episode"
              render={<button type="button" />}
              aria-label={`${episode.title}, ${show.title}`}
              caption={caption(episode, library)}
              title={episode.title}
              subtitle={episode.description}
              footnote={episode.duration > 0 ? formatDuration(episode.duration) : undefined}
              artwork={<ShowArtwork id={show.id} colors={show.colors} src={show.artwork} />}
              onClick={() => library.onPlay(episodes, index)}
              {...library.dragEpisode?.(episode)}
            />
          </WithMenu>
        );
      })}
    </CardGrid>
  );
}

export interface ShowGridProps {
  title: string;
  shows: readonly PodcastsShow[];
  /** Called with the show whose card is activated. */
  onOpen: (show: PodcastsShow) => void;
  /** One row that scrolls sideways instead of a wrapping grid. */
  shelf?: boolean;
  /** A command at the header's trailing edge, such as Refresh. */
  action?: ReactNode;
  /** The rows of a show's contextual menu; a show has none without it. */
  showMenu?: (show: PodcastsShow) => ReactNode;
}

/** Shows as square cards: a click on a card opens the show's page. */
export function ShowGrid({ title, shows, onOpen, shelf = false, action, showMenu }: ShowGridProps) {
  return (
    <CardGrid
      title={title}
      action={action}
      layout={shelf ? "shelf" : "grid"}
      separator
      headingLevel={3}
    >
      {shows.map((show) => (
        <WithMenu key={show.id} label={show.title} items={showMenu?.(show)}>
          <CardGridCard
            variant="square"
            render={<button type="button" />}
            title={show.title}
            subtitle={show.author}
            artwork={<ShowArtwork id={show.id} colors={show.colors} src={show.artwork} />}
            onClick={() => onOpen(show)}
          />
        </WithMenu>
      ))}
    </CardGrid>
  );
}

export interface ShowChartProps {
  title: string;
  shows: readonly PodcastsShow[];
  /** The `id`s of the shows the library follows. */
  subscribed: ReadonlySet<string>;
  /** Called with the show whose button is activated. */
  onSubscribe: (show: PodcastsShow) => void;
  /**
   * Why a show cannot be followed, or `undefined` when it can: its button is then unavailable
   * and says so. Every show can be followed when this is absent.
   */
  unavailable?: (show: PodcastsShow) => string | undefined;
  /** Called with the show whose title is activated: its page opens. Titles are text without it. */
  onOpen?: (show: PodcastsShow) => void;
  /** The rows of a show's contextual menu; a show has none without it. */
  showMenu?: (show: PodcastsShow) => ReactNode;
}

/** A ranked list of shows as lockups, each with a button that follows or unfollows it. */
export function ShowChart({
  title,
  shows,
  subscribed,
  onSubscribe,
  unavailable,
  onOpen,
  showMenu,
}: ShowChartProps) {
  return (
    <CardGrid title={title} columns={2} separator headingLevel={3}>
      {shows.map((show, index) => {
        const follows = subscribed.has(show.id);
        const reason = follows ? undefined : unavailable?.(show);
        const name = `${index + 1}. ${show.title}`;
        return (
          <WithMenu key={show.id} label={show.title} items={showMenu?.(show)}>
            <CardGridCard
              variant="lockup"
              title={
                onOpen ? (
                  <button
                    type="button"
                    className="mac-podcasts-link"
                    aria-label={`Open ${show.title}`}
                    onClick={() => onOpen(show)}
                  >
                    {name}
                  </button>
                ) : (
                  name
                )
              }
              subtitle={
                reason
                  ? `${show.category} · ${show.author} · Not available here`
                  : `${show.category} · ${show.author}`
              }
              artwork={<ShowArtwork id={show.id} colors={show.colors} src={show.artwork} />}
              accessory={
                reason ? (
                  <StorePillButton
                    aria-label={`${show.title} cannot be followed here: ${reason}`}
                    title={reason}
                    disabled
                  >
                    Unavailable
                  </StorePillButton>
                ) : (
                  <StorePillButton
                    aria-label={`${follows ? "Unsubscribe from" : "Subscribe to"} ${show.title}`}
                    onClick={() => onSubscribe(show)}
                  >
                    {follows ? "Subscribed" : "Subscribe"}
                  </StorePillButton>
                )
              }
            />
          </WithMenu>
        );
      })}
    </CardGrid>
  );
}

export interface EpisodeListProps {
  title: string;
  episodes: readonly PodcastsEpisode[];
  library: PodcastsLibrary;
  action?: ReactNode;
  /**
   * Columns of lockups.
   * @default 2
   */
  columns?: number;
  style?: CSSProperties;
  /** More of an episode's buttons, after its Play button (the Ferrite build's Up Next ones). */
  extra?: (episode: PodcastsEpisode, index: number) => ReactNode;
  /**
   * What Delete does to the episodes chosen, in a list that holds them for the person, such as Up
   * Next. Delete does nothing without it.
   */
  onRemove?: (episodes: readonly PodcastsEpisode[]) => void;
  /** What an episode's card takes when something is dropped on it. */
  rowDrop?: (episode: PodcastsEpisode) => HTMLAttributes<HTMLElement>;
}

/** Episodes as lockups, each with a button that plays it, or pauses it while it plays. */
export function EpisodeList({
  title,
  episodes,
  library,
  action,
  columns = 2,
  style,
  extra,
  onRemove,
  rowDrop,
}: EpisodeListProps) {
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const anchor = useRef<string | null>(null);
  const focused = useRef<string | null>(null);
  const grid = useRef<HTMLElement>(null);
  const order = episodes.map((episode) => episode.id);
  const press = (event: MouseEvent, id: string) => {
    if (!library.episodesMenu || (event.target as Element).closest("button")) return;
    grid.current?.focus({ preventScroll: true });
    focused.current = id;
    const command = event.metaKey || event.ctrlKey;
    if (command) {
      setChosen((now) => (now.includes(id) ? now.filter((one) => one !== id) : [...now, id]));
    } else if (event.shiftKey) {
      const from = order.indexOf(anchor.current ?? id);
      const to = order.indexOf(id);
      setChosen(from < 0 ? [id] : order.slice(Math.min(from, to), Math.max(from, to) + 1));
    } else {
      setChosen([id]);
    }
    if (!event.shiftKey) anchor.current = id;
  };
  const together = episodes.filter((episode) => chosen.includes(episode.id));
  /** The arrow keys step along the list, and with Shift widen the choice from where it began. */
  const step = (event: KeyboardEvent<HTMLElement>, by: number) => {
    const at = order.indexOf(focused.current ?? anchor.current ?? "");
    const to = order[at < 0 ? 0 : Math.min(order.length - 1, Math.max(0, at + by))];
    if (!to) return;
    event.preventDefault();
    focused.current = to;
    if (event.shiftKey && anchor.current) {
      const from = order.indexOf(anchor.current);
      const end = order.indexOf(to);
      setChosen(order.slice(Math.min(from, end), Math.max(from, end) + 1));
    } else {
      anchor.current = to;
      setChosen([to]);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.target as Element).closest("button, input")) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setChosen(order);
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      step(event, 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      step(event, -1);
    } else if (together.length === 0) {
      return;
    } else if (event.key === "Escape") {
      event.preventDefault();
      setChosen([]);
    } else if (onRemove && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      onRemove(together);
      setChosen([]);
    }
  };
  const selectable = library.episodesMenu !== undefined;
  return (
    <CardGrid
      ref={grid}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={selectable ? onKeyDown : undefined}
      title={title}
      action={action}
      columns={columns}
      separator
      headingLevel={3}
      style={style}
    >
      {episodes.map((episode, index) => {
        const show = library.showOf(episode);
        const loaded = library.current?.id === episode.id;
        const running = loaded && library.playing;
        const position = library.positionOf(episode);
        const length =
          episode.duration <= 0
            ? null
            : position === undefined
              ? formatDuration(episode.duration)
              : formatRemaining(episode.duration - position);
        const play = (
          <StorePillButton
            aria-label={`${running ? "Pause" : "Play"} ${episode.title}`}
            onClick={() => (loaded ? library.onToggle() : library.onPlay(episodes, index))}
          >
            {running ? "Pause" : "Play"}
          </StorePillButton>
        );
        const more = extra?.(episode, index);
        const subtitle = [
          show.title,
          episode.day,
          ...(length === null ? [] : [length]),
          ...(library.isPlayed(episode) ? ["Played"] : []),
        ].join(" · ");
        const isChosen = chosen.includes(episode.id);
        return (
          <WithMenu
            key={episode.id}
            label={episode.title}
            items={
              isChosen && together.length > 1
                ? library.episodesMenu?.(together)
                : library.episodeMenu?.(episode)
            }
          >
            <CardGridCard
              variant="lockup"
              title={episode.title}
              subtitle={subtitle}
              className={isChosen ? "mac-podcasts-chosen" : undefined}
              data-episode-id={episode.id}
              onClick={(event: MouseEvent) => press(event, episode.id)}
              onMouseDown={(event: MouseEvent) => {
                if (event.shiftKey) event.preventDefault();
              }}
              {...library.dragEpisode?.(episode)}
              {...rowDrop?.(episode)}
              artwork={<ShowArtwork id={show.id} colors={show.colors} src={show.artwork} />}
              accessory={
                more ? (
                  <span className="mac-podcasts-actions">
                    {play}
                    {more}
                  </span>
                ) : (
                  play
                )
              }
            />
          </WithMenu>
        );
      })}
    </CardGrid>
  );
}

export interface ShowPageProps {
  show: PodcastsShow;
  episodes: readonly PodcastsEpisode[];
  library: PodcastsLibrary;
  subscribed: boolean;
  onSubscribe: () => void;
  /** The name of the place the page was opened from. */
  origin: string;
  onBack: () => void;
  /**
   * Why the show cannot be followed here, or `undefined` when it can: the Subscribe button is
   * then unavailable and the reason is shown under the description.
   */
  unavailable?: string;
  /** A note under the episodes: that they are loading, or why they could not be read. */
  note?: ReactNode;
  /** More of an episode's buttons, after its Play button. */
  extra?: EpisodeListProps["extra"];
  /** The rows of the show's contextual menu, opened on its cover and description. */
  showMenu?: (show: PodcastsShow) => ReactNode;
}

export interface EpisodePageProps {
  episode: PodcastsEpisode;
  library: PodcastsLibrary;
  /** Why an episode cannot be downloaded: the dimmed button says it. */
  noDownload: string;
  /** The name of the place Back goes to. */
  origin: string;
  onBack: () => void;
  onGoToShow: () => void;
  /** The Up Next button. */
  extra?: ReactNode;
}

/** An episode's own page: its show, day and length, what the feed says of it, and its commands. */
export function EpisodePage({
  episode,
  library,
  noDownload,
  origin,
  onBack,
  onGoToShow,
  extra,
}: EpisodePageProps) {
  const show = library.showOf(episode);
  const loaded = library.current?.id === episode.id;
  const menu = library.episodeMenu?.(episode);
  return (
    <WithMenu label={episode.title} items={menu}>
      <section className="mac-podcasts-show" aria-label="Episode">
        <div className="mac-podcasts-show-cover">
          <ShowArtwork id={show.id} colors={show.colors} src={show.artwork} />
        </div>
        <div className="mac-podcasts-show-text">
          <p className="mac-podcasts-show-category">
            {[episode.date, episode.duration > 0 ? formatDuration(episode.duration) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h2 className="mac-podcasts-show-title">{episode.title}</h2>
          <p className="mac-podcasts-show-author">
            <SectionAction onClick={onGoToShow}>{show.title}</SectionAction>
          </p>
          <div className="mac-podcasts-episode-actions">
            <StorePillButton
              variant="filled"
              onClick={() => (loaded ? library.onToggle() : library.onPlay([episode], 0))}
            >
              {loaded && library.playing ? "Pause" : "Play"}
            </StorePillButton>
            {extra}
            <StorePillButton disabled title={noDownload}>
              Download
            </StorePillButton>
          </div>
          {episode.description.split("\n\n").map((paragraph, index) => (
            // The paragraphs of plain text never change order while shown.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <p key={index} className="mac-podcasts-show-description">
              {paragraph}
            </p>
          ))}
          <div>
            <SectionAction onClick={onBack}>Back to {origin}</SectionAction>
          </div>
        </div>
      </section>
    </WithMenu>
  );
}

/** A show's page: its cover and description, a button that follows it, and its episodes. */
export function ShowPage({
  show,
  episodes,
  library,
  subscribed,
  onSubscribe,
  origin,
  onBack,
  unavailable,
  note,
  extra,
  showMenu,
}: ShowPageProps) {
  const blocked = unavailable !== undefined && !subscribed;
  return (
    <>
      <WithMenu label={show.title} items={showMenu?.(show)}>
        <div className="mac-podcasts-show">
          <div className="mac-podcasts-show-cover">
            <ShowArtwork id={show.id} colors={show.colors} src={show.artwork} />
          </div>
          <div className="mac-podcasts-show-text">
            <p className="mac-podcasts-show-category">{show.category}</p>
            <h2 className="mac-podcasts-show-title">{show.title}</h2>
            <p className="mac-podcasts-show-author">{show.author}</p>
            <p className="mac-podcasts-show-description">{show.description}</p>
            {blocked ? <p className="mac-podcasts-show-reason">{unavailable}</p> : null}
            <div>
              <StorePillButton
                variant={subscribed ? "tinted" : "filled"}
                disabled={blocked}
                onClick={onSubscribe}
              >
                {subscribed ? "Unsubscribe" : blocked ? "Unavailable" : "Subscribe"}
              </StorePillButton>
            </div>
          </div>
        </div>
      </WithMenu>
      <EpisodeList
        title="Episodes"
        episodes={episodes}
        library={library}
        columns={1}
        action={<SectionAction onClick={onBack}>Back to {origin}</SectionAction>}
        extra={extra}
      />
      {note ? (
        <p className="mac-podcasts-note" role="status">
          {note}
        </p>
      ) : null}
    </>
  );
}

export interface SidePanelProps {
  /** Which of the bar's two trailing buttons opened the panel. */
  kind: "notes" | "queue";
  library: PodcastsLibrary;
  /** The episodes of the queue after the loaded one. */
  upcoming: readonly PodcastsEpisode[];
  /** More of a queued episode's buttons, after its Play button. */
  queueExtra?: EpisodeListProps["extra"];
  /** What Delete does to the queued episodes chosen. */
  queueRemove?: EpisodeListProps["onRemove"];
  /** What a queued episode's card takes when something is dropped on it. */
  queueRowDrop?: EpisodeListProps["rowDrop"];
  /** What the queue's panel takes when something is dropped on it. */
  queueDrop?: HTMLAttributes<HTMLElement>;
  /** What follows the queue in its panel. */
  queueFooter?: ReactNode;
}

const PANEL_LIST = {
  "--mac-card-grid-margin": "0px",
  "--mac-card-grid-title": "var(--mac-color-label)",
  "--mac-card-grid-separator": "transparent",
} as CSSProperties;

/** The panel at the pane's trailing edge: the loaded episode's notes, or what plays next. */
export function SidePanel({
  kind,
  library,
  upcoming,
  queueExtra,
  queueFooter,
  queueRemove,
  queueRowDrop,
  queueDrop,
}: SidePanelProps) {
  const { current } = library;
  let content: ReactNode;
  if (kind === "notes") {
    content = current ? (
      <div className="mac-podcasts-panel-text">
        <h3 className="mac-podcasts-panel-title">{current.title}</h3>
        <p className="mac-podcasts-panel-source">
          {library.showOf(current).title} — {current.date}
        </p>
        {current.description.split("\n\n").map((paragraph, index) => (
          // The paragraphs of plain text never change order while shown.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    ) : (
      <EmptyState>Not Playing</EmptyState>
    );
  } else {
    content = upcoming.length ? (
      <div className="mac-podcasts-panel-text">
        <EpisodeList
          title="Playing Next"
          episodes={upcoming}
          library={library}
          columns={1}
          style={PANEL_LIST}
          extra={queueExtra}
          onRemove={queueRemove}
          rowDrop={queueRowDrop}
        />
        {queueFooter}
      </div>
    ) : (
      <>
        <EmptyState>No Upcoming Episodes</EmptyState>
        {queueFooter ? <div className="mac-podcasts-panel-text">{queueFooter}</div> : null}
      </>
    );
  }
  return (
    <section
      className="mac-podcasts-panel"
      aria-label={kind === "notes" ? "Episode Notes" : "Queue"}
      {...(kind === "queue" ? queueDrop : undefined)}
    >
      {content}
    </section>
  );
}
