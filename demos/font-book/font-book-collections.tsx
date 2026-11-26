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
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import type { Ref } from "react";
import {
  DOWNLOAD_REASON,
  type FontCollection,
  type FontFamily,
  REMOVED_FOLDER,
} from "./font-book-data";

/** The longest name the server keeps. */
const MAX_NAME = 100;

/** A collection's name, edited in place in its sidebar row. */
export function CollectionNameField({
  name,
  inputRef,
  className = "mac-font-book-rename",
  onCommit,
  onCancel,
}: {
  name: string;
  inputRef: Ref<HTMLInputElement>;
  className?: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <input
      ref={inputRef}
      className={className}
      aria-label="Collection name"
      defaultValue={name}
      maxLength={MAX_NAME}
      // biome-ignore lint/a11y/noAutofocus: editing a name starts with its text selected, as in a Mac's outline
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        // The sidebar's own keys stay out of the name; the menu bar's commands still answer.
        if (!event.metaKey && !event.ctrlKey) event.stopPropagation();
        if (event.key === "Enter") onCommit(event.currentTarget.value);
        else if (event.key === "Escape") onCancel();
      }}
      onBlur={(event) => onCommit(event.currentTarget.value)}
    />
  );
}

/** A font row's context menu. */
export function FontContextItems({
  enableTitle,
  canToggle,
  onToggle,
  removeTitle,
  canRemove,
  onRemove,
  collections,
  onAddTo,
  onNewCollection,
  canValidate,
  onValidate,
  canExport,
  onExport,
  canReveal,
  onReveal,
  notDownloaded,
}: {
  enableTitle: string;
  canToggle: boolean;
  onToggle: () => void;
  removeTitle: string;
  canRemove: boolean;
  onRemove: () => void;
  /** The collections fonts can be added to: the person's own. */
  collections: readonly FontCollection[];
  onAddTo: (collection: string) => void;
  onNewCollection: () => void;
  canValidate: boolean;
  onValidate: () => void;
  /** Whether a font selected has a file to export: one the person added. */
  canExport: boolean;
  onExport: () => void;
  /** Whether one font is selected, with its file on the drive. */
  canReveal: boolean;
  onReveal: () => void;
  /** The name of the family selected that macOS lists and has not downloaded. */
  notDownloaded?: string;
}) {
  return (
    <>
      <MenuItem disabled={!canToggle} onClick={onToggle}>
        {enableTitle}
      </MenuItem>
      <MenuItem disabled={!canRemove} onClick={onRemove}>
        {removeTitle}
      </MenuItem>
      {notDownloaded ? (
        <>
          <MenuItem disabled title={DOWNLOAD_REASON} data-reason={DOWNLOAD_REASON}>
            Download “{notDownloaded}”
          </MenuItem>
          <MenuItem disabled>{DOWNLOAD_REASON}</MenuItem>
        </>
      ) : null}
      <MenuSeparator />
      <MenuItem disabled={!canValidate} onClick={onValidate}>
        Validate Font
      </MenuItem>
      <MenuItem disabled={!canExport} onClick={onExport}>
        Export Fonts…
      </MenuItem>
      <MenuItem disabled={!canReveal} onClick={onReveal}>
        Reveal in Finder
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={onNewCollection}>New Collection from Selection</MenuItem>
      <Submenu>
        <SubmenuTrigger>Add to Collection</SubmenuTrigger>
        <SubmenuPopup>
          {collections.length === 0 ? (
            <MenuItem disabled>No collection of yours yet</MenuItem>
          ) : (
            collections.map(({ id, name }) => (
              <MenuItem key={id} onClick={() => onAddTo(id)}>
                {name}
              </MenuItem>
            ))
          )}
        </SubmenuPopup>
      </Submenu>
    </>
  );
}

/** A sidebar row's context menu, and the sidebar's where no row is under the pointer. */
export function CollectionContextItems({
  editable,
  enableTitle,
  canToggle,
  onToggle,
  onRename,
  onDelete,
  onNewCollection,
  canExport,
  onExport,
  deletable = editable,
  onEditSmart,
}: {
  /** Whether the row is a collection the person made: the others cannot be changed. */
  editable: boolean;
  enableTitle: string;
  canToggle: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
  onNewCollection: () => void;
  /** Whether the collection holds a font with a file to export. */
  canExport: boolean;
  onExport: () => void;
  /** Whether the row can be deleted: also a smart collection the person made. */
  deletable?: boolean;
  /** Given for a smart collection the person made. */
  onEditSmart?: () => void;
}) {
  return (
    <>
      <MenuItem onClick={onNewCollection}>New Collection</MenuItem>
      <MenuSeparator />
      <MenuItem disabled={!editable} onClick={onRename}>
        Rename Collection
      </MenuItem>
      {onEditSmart ? <MenuItem onClick={onEditSmart}>Edit Smart Collection…</MenuItem> : null}
      <MenuItem disabled={!deletable} onClick={onDelete}>
        Delete Collection
      </MenuItem>
      {deletable ? null : <MenuItem disabled>Only a collection you made can change</MenuItem>}
      <MenuSeparator />
      <MenuItem disabled={!canToggle} onClick={onToggle}>
        {enableTitle}
      </MenuItem>
      <MenuItem disabled={!canExport} onClick={onExport}>
        Export Collection…
      </MenuItem>
    </>
  );
}

/** The question before added fonts go: their files go to the Trash. */
export function RemoveFontsAlert({
  fonts,
  onCancel,
  onRemove,
}: {
  fonts: readonly FontFamily[] | null;
  onCancel: () => void;
  onRemove: (fonts: readonly FontFamily[]) => void;
}) {
  return (
    <Alert open={fonts !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertPopup>
        <AlertMessage>
          {fonts?.length === 1
            ? `Are you sure you want to remove \u201c${fonts[0]?.name}\u201d?`
            : `Are you sure you want to remove these ${fonts?.length} fonts?`}
        </AlertMessage>
        <AlertInformativeText>
          {fonts?.length === 1
            ? "Its file goes to the Trash on your drive."
            : "Their files go to the Trash on your drive."}
        </AlertInformativeText>
        <AlertButtons>
          <AlertClose>Cancel</AlertClose>
          <AlertClose
            render={<DefaultButton />}
            onClick={() => {
              if (fonts) onRemove(fonts);
            }}
          >
            Remove
          </AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

/** Why a change to the fonts on the drive did not happen. */
export function FontNoticeAlert({
  notice,
  onClose,
}: {
  notice: string | null;
  onClose: () => void;
}) {
  return (
    <Alert open={notice !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertPopup>
        <AlertMessage>{notice}</AlertMessage>
        <AlertButtons>
          <AlertClose render={<DefaultButton />}>OK</AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

/** File > Restore Standard Fonts…: what it will do, and the person's yes. */
export function RestoreFontsAlert({
  open,
  onCancel,
  onRestore,
}: {
  open: boolean;
  onCancel: () => void;
  onRestore: () => void;
}) {
  return (
    <Alert open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertPopup>
        <AlertMessage>Are you sure you want to restore the standard fonts?</AlertMessage>
        <AlertInformativeText>
          The fonts you added move to “{REMOVED_FOLDER}” in Documents, and every font that is off
          turns on.
        </AlertInformativeText>
        <AlertButtons>
          <AlertClose>Cancel</AlertClose>
          <AlertClose render={<DefaultButton />} onClick={onRestore}>
            Proceed
          </AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

/** The question before a collection goes. Its fonts stay in the library. */
export function DeleteCollectionAlert({
  collection,
  onCancel,
  onDelete,
}: {
  collection: FontCollection | null;
  onCancel: () => void;
  onDelete: (collection: FontCollection) => void;
}) {
  return (
    <Alert open={collection !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertPopup>
        <AlertMessage>
          Are you sure you want to delete the collection {"\u201c"}
          {collection?.name}
          {"\u201d"}?
        </AlertMessage>
        <AlertInformativeText>Its fonts stay in your library.</AlertInformativeText>
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
