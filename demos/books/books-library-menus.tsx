"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { Form, FormRow } from "macalicious/form";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { LinkShareItems } from "../desktop/desktop-share-link";
import { showInFinder } from "../finder/finder-open";
import { type BooksCollection, FINISHED, HIDDEN, WANT_TO_READ } from "./books-data";
import { bookWebAddress, fromFile, type OwnedBook, SOURCE_NAMES } from "./books-server";

/** Why File > Reveal in Finder and the cover's row are dimmed. */
export const NOT_A_FILE_REASON =
  "Books keeps its texts on the desktop's server, not on your drive, so Finder has no file to show.";

/** A row of a menu that cannot act, with the true reason as its help tag and description. */
export function DimmedRow({ reason, children }: { reason: string; children: string }) {
  return (
    <MenuItem disabled title={reason} data-reason={reason}>
      {children}
    </MenuItem>
  );
}

/** Why a book added from a file offers no Share Book. */
export const NO_WEB_PAGE_REASON =
  "This book is a file on your drive: it has no page on the web to share.";

/** Reveal in Finder: a book added from a file is on the drive; any other is not. */
export function RevealBookRow({ book }: { book: { file?: string } | null }) {
  const file = book?.file;
  return file ? (
    <MenuItem onClick={() => showInFinder({ id: file })}>Reveal in Finder</MenuItem>
  ) : (
    <DimmedRow reason={NOT_A_FILE_REASON}>Reveal in Finder</DimmedRow>
  );
}

/** The Share Book rows: the book's page at its source, as Mail, Messages and Notes take a link. */
export function BookShareMenu({
  title,
  book,
}: {
  title: string;
  book: { id: string; title: string };
}) {
  if (fromFile(book)) return <DimmedRow reason={NO_WEB_PAGE_REASON}>{title}</DimmedRow>;
  return (
    <Submenu>
      <SubmenuTrigger>{title}</SubmenuTrigger>
      <SubmenuPopup>
        <LinkShareItems plain url={bookWebAddress(book.id)} title={book.title} from="books" />
      </SubmenuPopup>
    </Submenu>
  );
}

/** What a cover's menu acts on: the one cover, or every cover selected with it. */
export interface BookMenuTarget {
  ids: readonly string[];
  /** The collection the covers are listed in, when they are listed in one. */
  collection: BooksCollection | undefined;
}

/** A cover's menu: open it, its reading lists and collections, Get Info, and Remove. */
export function BookContextItems({
  target: { ids, collection },
  book,
  collections,
  inList,
  onOpen,
  onSetList,
  onNewCollectionWith,
  onInfo,
  onRemove,
}: {
  target: BookMenuTarget;
  /** The cover the menu was opened on: what one-book rows act on. */
  book: { id: string; title: string; file?: string };
  /** The collections the person made. */
  collections: readonly BooksCollection[];
  inList: (list: string, id: string) => boolean;
  onOpen: () => void;
  onSetList: (list: string, ids: readonly string[], member: boolean) => void;
  onNewCollectionWith: (ids: readonly string[]) => void;
  onInfo: () => void;
  onRemove: () => void;
}) {
  const several = ids.length > 1;
  const every = (list: string) => ids.every((id) => inList(list, id));
  const finished = every(FINISHED.id);
  const wanted = every(WANT_TO_READ.id);
  const hidden = every(HIDDEN.id);
  return (
    <>
      <MenuItem disabled={several} onClick={onOpen}>
        Open
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        onClick={() => {
          onSetList(FINISHED.id, ids, !finished);
          if (!finished) onSetList(WANT_TO_READ.id, ids, false);
        }}
      >
        {finished ? "Mark as Unfinished" : "Mark as Finished"}
      </MenuItem>
      <MenuItem onClick={() => onSetList(WANT_TO_READ.id, ids, !wanted)}>
        {wanted ? "Remove from Want to Read" : "Add to Want to Read"}
      </MenuItem>
      <MenuItem onClick={() => onSetList(HIDDEN.id, ids, !hidden)}>
        {hidden ? "Unhide Book" : "Hide Book"}
      </MenuItem>
      <Submenu>
        <SubmenuTrigger>Add to Collection</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem onClick={() => onNewCollectionWith(ids)}>New Collection</MenuItem>
          {collections.length > 0 ? <MenuSeparator /> : null}
          {collections.map((each) => (
            <MenuItem key={each.id} onClick={() => onSetList(each.id, ids, true)}>
              {each.name}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      {collection ? (
        <MenuItem onClick={() => onSetList(collection.id, ids, false)}>
          Remove from “{collection.name}”
        </MenuItem>
      ) : null}
      <MenuSeparator />
      <MenuItem disabled={several} onClick={onInfo}>
        Get Info
      </MenuItem>
      <RevealBookRow book={book} />
      <BookShareMenu title="Share Book" book={book} />
      <MenuSeparator />
      <MenuItem onClick={onRemove}>
        {several ? `Remove ${ids.length} Books from Library` : "Remove from Library"}
      </MenuItem>
    </>
  );
}

/** File > Get Info: what the library knows of a book. */
export function BookInfoSheet({
  book,
  anchor,
  lists,
  onClose,
}: {
  book: OwnedBook | null;
  anchor: HTMLElement | null;
  /** The names of the collections and reading lists that hold it. */
  lists: readonly string[];
  onClose: () => void;
}) {
  return (
    <Sheet open={book !== null} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={360}>
        <SheetTitle>{book?.title}</SheetTitle>
        <Form size="small" render={<div />}>
          <FormRow label="Author:">{book?.author}</FormRow>
          <FormRow label="From:">{book ? SOURCE_NAMES[book.source] : ""}</FormRow>
          <FormRow label="Added:">{book ? new Date(book.added).toLocaleDateString() : ""}</FormRow>
          <FormRow label="In:">{lists.length > 0 ? lists.join(", ") : "All Books"}</FormRow>
        </Form>
        <SheetActions>
          <SheetClose render={<DefaultButton />}>Done</SheetClose>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** The question before a collection goes. Its books stay in the library. */
export function DeleteBooksCollectionAlert({
  collection,
  onCancel,
  onDelete,
}: {
  collection: BooksCollection | null;
  onCancel: () => void;
  onDelete: (collection: BooksCollection) => void;
}) {
  return (
    <Alert open={collection !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertPopup>
        <AlertMessage>Delete the collection “{collection?.name}”?</AlertMessage>
        <AlertInformativeText>Its books stay in your library.</AlertInformativeText>
        <AlertButtons>
          <AlertClose>Cancel</AlertClose>
          <AlertClose
            render={<DefaultButton />}
            onClick={() => {
              if (collection) onDelete(collection);
            }}
          >
            Delete
          </AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}
