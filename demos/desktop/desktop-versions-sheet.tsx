"use client";

import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { type ReactNode, useEffect, useState } from "react";
import {
  type FileVersions,
  type KeptVersion,
  listVersions,
  readVersion,
  versionDate,
} from "./desktop-files";

const DATE_COLUMN: readonly TableViewColumn[] = [{ id: "date" }];

/**
 * File > Revert To > Browse All Versions…: the versions the drive keeps of a file, the chosen one
 * beside the document as it stands, with Restore and Done. A sheet, not the Time Machine star field
 * of the real apps. An app draws its own pages and styles its own panes: `classPrefix` names
 * `<prefix>-versions` (the three columns), `<prefix>-versions-list`, `<prefix>-version` (a pane) and
 * `<prefix>-version-note`.
 */
export function DesktopVersionsSheet<Page>({
  file,
  current,
  anchor,
  classPrefix,
  readPage,
  renderPage,
  onRestore,
  onDone,
}: {
  file: { id: string; name: string };
  /** The document as the window holds it. */
  current: Page;
  anchor: HTMLElement | null;
  classPrefix: string;
  /** A version's bytes as a page; a refusal's message is shown in its place. */
  readPage: (bytes: Uint8Array, version: KeptVersion) => Promise<Page> | Page;
  renderPage: (page: Page, label: string) => ReactNode;
  onRestore: (version: KeptVersion) => void;
  onDone: () => void;
}) {
  const [listed, setListed] = useState<FileVersions | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [read, setRead] = useState<{
    version: number;
    page?: { of: Page };
    note?: string;
  } | null>(null);

  useEffect(() => {
    let live = true;
    listVersions(file.id).then(
      (versions) => {
        if (!live) return;
        setListed(versions);
        setChosen(versions.versions[0]?.version ?? null);
      },
      (error) => {
        if (live) {
          setProblem(error instanceof Error ? error.message : "The drive could not be read.");
        }
      },
    );
    return () => {
      live = false;
    };
  }, [file.id]);

  const versions = listed?.versions ?? [];
  const picked = versions.find((kept) => kept.version === chosen);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a version's bytes never change, and `readPage` is a new function each render
  useEffect(() => {
    if (!picked) return;
    let live = true;
    setRead(null);
    readVersion(file.id, picked.version)
      .then((bytes) => readPage(bytes, picked))
      .then(
        (page) => {
          if (live) setRead({ version: picked.version, page: { of: page } });
        },
        (error) => {
          if (!live) return;
          setRead({
            version: picked.version,
            note: error instanceof Error ? error.message : "This version can’t be shown.",
          });
        },
      );
    return () => {
      live = false;
    };
  }, [file.id, picked?.version]);

  const pane = (label: string, body: ReactNode) => (
    <section className={`${classPrefix}-version`}>
      <Label>{label}</Label>
      {body}
    </section>
  );
  const note = (text: string) => <p className={`${classPrefix}-version-note`}>{text}</p>;
  const description =
    problem ??
    (listed === null
      ? "Reading the versions…"
      : versions.length === 0
        ? "This document has no earlier versions yet. Its next save keeps one."
        : null);
  const pickedLabel = picked ? versionDate(picked.modifiedMs) : "Earlier Version";
  return (
    <Sheet open onOpenChange={(open) => open || onDone()}>
      <SheetPopup anchor={anchor} width={760}>
        <SheetTitle>{`Versions of “${file.name}”`}</SheetTitle>
        <div className={`${classPrefix}-versions`}>
          <TableView
            aria-label="Versions"
            className={`${classPrefix}-versions-list`}
            columns={DATE_COLUMN}
            header="none"
            rowCount={versions.length}
            rowHeight={19}
            size="small"
            getRowId={(row) => String(versions[row]?.version)}
            getRowLabel={(row) => versionDate(versions[row]?.modifiedMs ?? 0)}
            value={chosen === null ? [] : [String(chosen)]}
            onValueChange={(value) => {
              const [first] = value;
              if (first !== undefined) setChosen(Number(first));
            }}
            renderCell={(row) => versionDate(versions[row]?.modifiedMs ?? 0)}
          />
          {pane("Current Document", renderPage(current, "Current Document"))}
          {pane(
            pickedLabel,
            description
              ? note(description)
              : read?.version !== chosen
                ? note("Reading this version…")
                : read?.page
                  ? renderPage(read.page.of, pickedLabel)
                  : note(read?.note ?? "This version can’t be shown."),
          )}
        </div>
        <SheetActions>
          <SheetClose>Done</SheetClose>
          <DefaultButton
            disabled={!picked || read?.version !== chosen}
            onClick={() => picked && onRestore(picked)}
          >
            Restore
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
