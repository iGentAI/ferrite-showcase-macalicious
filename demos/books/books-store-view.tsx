"use client";

import { BookCover } from "macalicious/book-cover";
import { BorderlessButton } from "macalicious/borderless-button";
import { CardGrid } from "macalicious/card-grid";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { ProgressSpinner } from "macalicious/progress-spinner";
import { PullDownButton } from "macalicious/pull-down-button";
import { PushButton } from "macalicious/push-button";
import { StorePillButton } from "macalicious/store-pill-button";
import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { copyText, LinkShareItems } from "../desktop/desktop-share-link";
import { RealCoverArtwork } from "./books-artwork";
import { BookShareMenu } from "./books-library-menus";
import { BookReviewsSection } from "./books-reviews";
import {
  type Audiobook,
  bookWebAddress,
  fetchAudiobook,
  fetchStore,
  type OwnedBook,
  SOURCE_NAMES,
  type StoreAsk,
  type StoreBook,
} from "./books-server";

/** How long typing rests before the store is searched. */
export const STORE_SEARCH_PAUSE_MS = 450;

/** As the library's covers: the card grid's margin and type, a cover as wide as its cell. */
const SHELF = {
  "--mac-card-grid-margin": "42px",
  "--mac-card-grid-title-font":
    "var(--mac-font-weight-semibold) 13px / 16px var(--mac-font-family-system)",
  "--mac-card-grid-header-padding": "0 0 10px",
} as CSSProperties;
const COVER = { "--mac-book-cover-width": "100%" } as CSSProperties;
/** The cover on a book's page. */
const PAGE_COVER = { "--mac-book-cover-width": "180px" } as CSSProperties;

/** Which page of the Book Store is shown. */
export type BooksStorePage =
  | { kind: "home" }
  | { kind: "charts" }
  | { kind: "featured" }
  | { kind: "book"; book: StoreBook }
  | { kind: "author"; author: string }
  | { kind: "genre"; genre: string };

export const STORE_HOME: BooksStorePage = { kind: "home" };

/** The genres the store offers: each is a subject at Project Gutenberg and a search at Standard Ebooks. */
export const STORE_GENRES: readonly string[] = [
  "Adventure",
  "Biography",
  "Children",
  "Drama",
  "Fantasy",
  "History",
  "Mystery",
  "Philosophy",
  "Poetry",
  "Romance",
  "Science Fiction",
  "Travel",
];

const shelvesOf = (
  page: BooksStorePage,
  audiobooks: boolean,
): { title: string; ask: StoreAsk }[] => {
  if (audiobooks) {
    return page.kind === "author"
      ? [{ title: `${page.author} at LibriVox`, ask: { query: page.author, source: "librivox" } }]
      : [{ title: "At LibriVox", ask: { shelf: "librivox" } }];
  }
  switch (page.kind) {
    case "charts":
      return [{ title: "Top Charts: Most Downloaded", ask: { shelf: "popular" } }];
    case "featured":
      return [{ title: "Featured: New at Standard Ebooks", ask: { shelf: "standard-ebooks" } }];
    case "genre":
      return [
        {
          title: `${page.genre} at Project Gutenberg`,
          ask: { query: `s.${page.genre}`, source: "gutenberg" },
        },
        {
          title: `${page.genre} at Standard Ebooks`,
          ask: { query: page.genre, source: "standard-ebooks" },
        },
      ];
    case "author":
      return [
        {
          title: `${page.author} at Project Gutenberg`,
          ask: { query: page.author, source: "gutenberg" },
        },
        {
          title: `${page.author} at Standard Ebooks`,
          ask: { query: page.author, source: "standard-ebooks" },
        },
      ];
    default:
      return [
        { title: "Popular at Project Gutenberg", ask: { shelf: "popular" } },
        { title: "New at Standard Ebooks", ask: { shelf: "standard-ebooks" } },
      ];
  }
};

export interface BooksStoreViewProps {
  /** The text of the toolbar's search field: empty shows the two shelves. */
  query: string;
  /** The person's books: a book they have is offered to read, not to get. */
  owned: readonly OwnedBook[];
  /** Called with a book the person gets. */
  onGet: (book: StoreBook) => void;
  /** The ids of the person's books that are only a sample so far. */
  samples?: readonly string[];
  /** Called with a book whose sample the person gets. */
  onSample?: (book: StoreBook) => void;
  /** Called with the id of a book of the library the person opens. */
  onRead: (id: string) => void;
  /** Why no book can be got now (the library is full), or nothing. */
  refusal?: string | null;
  /** The page shown while the toolbar's field is empty. */
  page?: BooksStorePage;
  /** Called with the page a cover, an author or the way back goes to. */
  onPage?: (page: BooksStorePage) => void;
  /** The Audiobook Store: LibriVox's catalogue in place of the two sources of text. */
  audiobooks?: boolean;
}

/** `value`, once it has stopped changing for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * The Book Store of Books on the desktop's Ferrite application: Project Gutenberg's most
 * downloaded books and Standard Ebooks' new releases, or, while the toolbar's field has text,
 * what each of the two finds for it. Every book is in the public domain in the United States.
 * Get adds a book to the person's library; a book they have is offered to read. A cover opens the
 * book's page, and its author's name that author's books at the two sources.
 */
export function BooksStoreView({
  query,
  owned,
  onGet,
  samples = NO_SAMPLES,
  onSample,
  onRead,
  refusal,
  page = STORE_HOME,
  onPage,
  audiobooks = false,
}: BooksStoreViewProps) {
  const text = useSettled(query.trim().replace(/\s+/g, " "), STORE_SEARCH_PAUSE_MS);
  const actions: BookActions = {
    owned,
    onGet,
    samples,
    onSample,
    onRead,
    refusal: refusal ?? null,
    onPage,
  };
  const away = page.kind !== "home";
  // A cover pressed among search results opens its page; a new search leaves whatever page is open.
  const searched = useRef(text);
  useEffect(() => {
    if (text === searched.current) return;
    searched.current = text;
    if (text !== "") onPage?.(STORE_HOME);
  }, [text, onPage]);
  const shelves: { title: string; ask: StoreAsk }[] =
    !away && audiobooks && text
      ? [{ title: "LibriVox", ask: { query: text, source: "librivox" } }]
      : !away && text
        ? [
            { title: "Project Gutenberg", ask: { query: text, source: "gutenberg" } },
            { title: "Standard Ebooks", ask: { query: text, source: "standard-ebooks" } },
          ]
        : shelvesOf(page, audiobooks);
  return (
    <div className="mac-books-store">
      {away ? (
        <BorderlessButton className="mac-books-store-back" onClick={() => onPage?.(STORE_HOME)}>
          ‹ {audiobooks ? "Audiobook Store" : "Book Store"}
        </BorderlessButton>
      ) : null}
      {away && page.kind === "book" ? <BookPage book={page.book} {...actions} /> : null}
      {text === "" && page.kind === "home" && !audiobooks ? (
        <nav className="mac-books-store-genres" aria-label="Genres">
          {STORE_GENRES.map((genre) => (
            <BorderlessButton
              key={genre}
              className="mac-books-store-author-link"
              onClick={() => onPage?.({ kind: "genre", genre })}
            >
              {genre}
            </BorderlessButton>
          ))}
        </nav>
      ) : null}
      {(away && page.kind === "book" ? [] : shelves).map((shelf) => (
        <StoreShelf
          key={`${shelf.title}\u0000${text}`}
          title={shelf.title}
          ask={shelf.ask}
          {...actions}
        />
      ))}
      <p className="mac-books-store-note">
        {audiobooks
          ? "Audiobooks from LibriVox, read by volunteers and in the public domain in the United States. The sound comes from the Internet Archive. A search finds the start of a title or an author's last name."
          : "Books from Project Gutenberg and Standard Ebooks, in the public domain in the United States. Standard Ebooks' editions are dedicated to the public domain under CC0."}
      </p>
    </div>
  );
}

interface BookActions {
  owned: readonly OwnedBook[];
  onGet: (book: StoreBook) => void;
  samples: readonly string[];
  onSample: ((book: StoreBook) => void) | undefined;
  onRead: (id: string) => void;
  refusal: string | null;
  onPage: ((page: BooksStorePage) => void) | undefined;
}

const NO_SAMPLES: readonly string[] = [];

/** A book's button: Read for one the person has whole, Get for one they have not or only a sample of. */
function GetOrRead({
  book,
  owned,
  onGet,
  samples,
  onRead,
  refusal,
}: { book: StoreBook } & BookActions) {
  return owned.some((item) => item.id === book.id) && !samples.includes(book.id) ? (
    <StorePillButton aria-label={`${readWord(book)} ${book.title}`} onClick={() => onRead(book.id)}>
      {readWord(book)}
    </StorePillButton>
  ) : (
    <StorePillButton
      aria-label={`Get ${book.title}`}
      disabled={refusal !== null}
      title={refusal ?? undefined}
      onClick={() => onGet(book)}
    >
      Get
    </StorePillButton>
  );
}

/** What the store calls opening a book the person has. */
const readWord = (book: StoreBook) => (book.source === "librivox" ? "Listen" : "Read");

const clockOf = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
};

/** An audiobook's chapters on its page, as LibriVox lists them. */
function AudiobookChapters({ id }: { id: string }) {
  const [book, setBook] = useState<Audiobook | string | null>(null);
  useEffect(() => {
    let live = true;
    fetchAudiobook(id).then(
      (found) => {
        if (live) setBook(found);
      },
      (error: unknown) => {
        if (live) setBook(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      live = false;
    };
  }, [id]);
  if (book === null) return <ProgressSpinner size="small" aria-label="Loading the chapters" />;
  if (typeof book === "string") {
    return <EmptyState role="status">The chapters could not be read: {book}</EmptyState>;
  }
  return (
    <section className="mac-books-store-chapters" aria-label="Chapters">
      <h3 className="mac-books-store-heading">
        {book.chapters.length} chapters, {clockOf(book.seconds)}
      </h3>
      <ol>
        {book.chapters.map((chapter) => (
          <li key={chapter.url}>
            <span>{chapter.title}</span>
            <span className="mac-books-store-author">{clockOf(chapter.seconds)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The Sample button, for a book the person does not have: the start of its text in My Samples. */
function SampleButton({
  book,
  owned,
  samples,
  onSample,
  onRead,
  refusal,
}: { book: StoreBook } & BookActions) {
  if (samples.includes(book.id)) {
    return <PushButton onClick={() => onRead(book.id)}>Read Sample</PushButton>;
  }
  if (owned.some((item) => item.id === book.id)) return null;
  return (
    <PushButton
      disabled={refusal !== null}
      title={refusal ?? undefined}
      onClick={() => onSample?.(book)}
    >
      Sample
    </PushButton>
  );
}

/** A book's page: its cover, what its source says of it, Get or Read, Share, and the author's. */
function BookPage({ book, ...actions }: { book: StoreBook } & BookActions) {
  const { onPage } = actions;
  return (
    <>
      <article className="mac-books-store-book" aria-label={book.title}>
        <BookCover className="mac-books-cover" style={PAGE_COVER}>
          <RealCoverArtwork cover={book.cover} title={book.title} author={book.author} />
        </BookCover>
        <div className="mac-books-store-book-text">
          <h2 className="mac-books-store-book-title">{book.title}</h2>
          {book.author ? (
            <BorderlessButton
              className="mac-books-store-author-link"
              onClick={() => onPage?.({ kind: "author", author: book.author })}
            >
              {book.author}
            </BorderlessButton>
          ) : (
            <span className="mac-books-store-author">Unknown author</span>
          )}
          <span className="mac-books-store-author">From {SOURCE_NAMES[book.source]}</span>
          <span className="mac-books-store-author">Free</span>
          <div className="mac-books-store-book-actions">
            <GetOrRead book={book} {...actions} />
            {book.source === "librivox" ? null : <SampleButton book={book} {...actions} />}
            <PullDownButton bordered={false} title="Share">
              <LinkShareItems plain url={bookWebAddress(book.id)} title={book.title} from="books" />
            </PullDownButton>
          </div>
          {book.summary ? <p className="mac-books-store-book-summary">{book.summary}</p> : null}
        </div>
      </article>
      {book.source === "librivox" ? (
        <AudiobookChapters id={book.id} />
      ) : (
        <BookReviewsSection book={book.id} />
      )}
      {book.author ? (
        <StoreShelf
          key={book.id}
          title={`More by ${book.author}`}
          ask={{ query: book.author, source: book.source }}
          {...actions}
        />
      ) : null}
    </>
  );
}

/** One book on a shelf, with its menu: Get or Read, its sample, its page, Copy Link and Share. */
function StoreItem({ book, ...actions }: { book: StoreBook } & BookActions) {
  const { owned, onGet, samples, onSample, onRead, refusal, onPage } = actions;
  const got = owned.some((item) => item.id === book.id);
  const sample = samples.includes(book.id);
  const showPage = () => onPage?.({ kind: "book", book });
  return (
    <ContextualMenu>
      <ContextualMenuTrigger render={<div className="mac-books-store-item" data-book={book.id} />}>
        <BookCover
          render={<button type="button" />}
          className="mac-books-cover"
          style={COVER}
          aria-label={`Show ${book.title}`}
          onClick={showPage}
        >
          <RealCoverArtwork cover={book.cover} title={book.title} author={book.author} />
        </BookCover>
        <span className="mac-books-store-title">{book.title}</span>
        <span className="mac-books-store-author">{book.author || "Unknown author"}</span>
        <GetOrRead book={book} {...actions} />
      </ContextualMenuTrigger>
      <ContextualMenuPopup aria-label={book.title}>
        {got && !sample ? (
          <MenuItem onClick={() => onRead(book.id)}>{readWord(book)}</MenuItem>
        ) : (
          <MenuItem
            disabled={refusal !== null}
            title={refusal ?? undefined}
            onClick={() => onGet(book)}
          >
            Get
          </MenuItem>
        )}
        {sample ? <MenuItem onClick={() => onRead(book.id)}>Read Sample</MenuItem> : null}
        {got || book.source === "librivox" ? null : (
          <MenuItem
            disabled={refusal !== null}
            title={refusal ?? undefined}
            onClick={() => onSample?.(book)}
          >
            Sample
          </MenuItem>
        )}
        <MenuItem onClick={showPage}>Show Book Page</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => void copyText(bookWebAddress(book.id))}>Copy Link</MenuItem>
        <BookShareMenu title="Share" book={book} />
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}

type ShelfState =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | {
      status: "ready";
      books: StoreBook[];
      more: boolean;
      page: number;
      adding: boolean;
      /** Why the last More Books failed; the same page is asked for again. */
      error: string | null;
    };

function StoreShelf({
  title,
  ask,
  ...actions
}: {
  title: string;
  ask: StoreAsk;
} & BookActions) {
  const [state, setState] = useState<ShelfState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const statusId = useId();
  const key = JSON.stringify(ask);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the ask is read through its key
  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    fetchStore(ask).then(
      (listing) => {
        if (live) setState({ status: "ready", ...listing, page: 1, adding: false, error: null });
      },
      (error: unknown) => {
        if (live) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );
    return () => {
      live = false;
    };
  }, [key, attempt]);

  const more = () => {
    if (state.status !== "ready" || state.adding) return;
    const page = state.page + 1;
    setState({ ...state, adding: true });
    fetchStore({ ...ask, page }).then(
      (listing) => {
        setState((now) => {
          if (now.status !== "ready") return now;
          const seen = new Set(now.books.map((book) => book.id));
          return {
            status: "ready",
            books: [...now.books, ...listing.books.filter((book) => !seen.has(book.id))],
            more: listing.more,
            page,
            adding: false,
            error: null,
          };
        });
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        setState((now) =>
          now.status === "ready" ? { ...now, adding: false, error: message } : now,
        );
      },
    );
  };

  if (state.status === "loading") {
    return (
      <section className="mac-books-store-shelf" aria-label={title} aria-busy="true">
        <h2 className="mac-books-store-heading">{title}</h2>
        <div className="mac-books-store-status">
          <ProgressSpinner size="small" aria-labelledby={statusId} />
          <span id={statusId}>Loading…</span>
        </div>
      </section>
    );
  }
  if (state.status === "failed") {
    return (
      <section className="mac-books-store-shelf" aria-label={title}>
        <h2 className="mac-books-store-heading">{title}</h2>
        <div className="mac-books-store-status">
          <EmptyState role="status">The store could not be reached: {state.message}</EmptyState>
          <PushButton onClick={() => setAttempt((count) => count + 1)}>Try Again</PushButton>
        </div>
      </section>
    );
  }
  return (
    <>
      {state.books.length === 0 ? (
        <section className="mac-books-store-shelf" aria-label={title}>
          <h2 className="mac-books-store-heading">{title}</h2>
          <EmptyState role="status" className="mac-books-store-status">
            No Results
          </EmptyState>
        </section>
      ) : (
        <CardGrid
          title={title}
          minCardWidth={145}
          gap={37.875}
          style={SHELF}
          className="mac-books-shelf mac-books-store-shelf"
        >
          {state.books.map((book) => (
            <StoreItem key={book.id} book={book} {...actions} />
          ))}
        </CardGrid>
      )}
      {state.more ? (
        <div className="mac-books-store-more">
          {state.error && !state.adding ? (
            <span role="status" className="mac-books-store-more-error">
              More books could not be loaded: {state.error}
            </span>
          ) : null}
          <PushButton disabled={state.adding} onClick={more}>
            {state.adding ? "Loading…" : "More Books"}
          </PushButton>
        </div>
      ) : null}
    </>
  );
}
