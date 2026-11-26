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
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { SavePanelRow } from "macalicious/save-panel";
import { Sheet, SheetPopup } from "macalicious/sheet";
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  DriveOpenPanel,
  DriveSavePanel,
  type DriveSaveTarget,
  saveToDrive,
} from "../finder/finder-file-dialogs";
import type { PageSetup, PrintableDocument } from "../textedit/textedit-drive";
import { isTextDocument, openDriveDocument } from "../textedit/textedit-files";
import { paragraphsOfContent, paragraphsOfLines, writeRtf } from "../textedit/textedit-rtf";
import { titleOf } from "./stickies-data";
import { characters } from "./stickies-sync";

/*
 * Stickies' File menu on the person's drive: Import Text makes a note of a text file, and Export
 * Text writes a note to one, as plain text or as RTF with its formats.
 */

export type StickiesFileDialog =
  | { kind: "import" }
  | { kind: "export"; text: string; html?: string; anchor: HTMLElement | null };

type ExportFormat = "plain" | "rtf";

/** The note's text as RTF, read from a document that runs nothing of what the note holds. */
export function noteAsRtf(text: string, html?: string): string {
  return writeRtf(
    html === undefined
      ? paragraphsOfLines(text.split("\n"))
      : paragraphsOfContent(new DOMParser().parseFromString(html, "text/html").body),
  );
}

/** A name typed in the Export sheet, with the extension of the format chosen. */
export function exportName(typed: string, format: ExportFormat): string {
  const name = typed.trim();
  if (format === "rtf") return `${name.replace(/\.(txt|rtf)$/i, "")}.rtf`;
  if (/\.rtf$/i.test(name)) return `${name.slice(0, -4)}.txt`;
  return /\.[a-z0-9]+$/i.test(name) ? name : `${name}.txt`;
}

const NO_RTFD =
  "An RTFD is a folder of files, and Export Text writes one file: a note's pictures stay in the note.";

export interface StickiesFileDialogsProps {
  dialog: StickiesFileDialog | null;
  /** The longest text a note keeps: a longer file is refused, rather than cut short. */
  maxText: number;
  /** Whether another note can be kept: a file is not read for a note that could not be made. */
  canAdd: boolean;
  /** Called with the text of the file chosen to import. */
  onImport: (text: string) => void;
  onDone: () => void;
  /** What could not be done, for the alert that says so; `null` when there is nothing to say. */
  failure: string | null;
  onFailure: (failure: string | null) => void;
}

/** A drive file's text, as a note holds it: RTF reads as its text, its formats dropped. */
export async function readNoteFile(entry: { id: string; name: string }): Promise<string> {
  const { document: read } = await openDriveDocument(entry, document);
  return read.lines.join("\n");
}

/** The dialogs of Import Text and Export Text, and what they say when the drive refuses. */
export function StickiesFileDialogs({
  dialog,
  maxText,
  canAdd,
  onImport,
  onDone,
  failure,
  onFailure: setFailure,
}: StickiesFileDialogsProps) {
  const importEntry = async (entry: { id: string; name: string }) => {
    onDone();
    if (!canAdd) {
      setFailure(`“${entry.name}” wasn’t imported: Stickies can’t keep another note.`);
      return;
    }
    try {
      const text = await readNoteFile(entry);
      if (characters(text) > maxText) setFailure(`“${entry.name}” is longer than a note can hold.`);
      else onImport(text);
    } catch {
      setFailure(`“${entry.name}” could not be read as text.`);
    }
  };
  const [format, setFormat] = useState<ExportFormat>("plain");
  const formatLabel = useId();
  const exportTo = async (target: DriveSaveTarget, text: string, html?: string) => {
    onDone();
    try {
      await saveToDrive(
        target,
        format === "rtf"
          ? new Blob([noteAsRtf(text, html)], { type: "application/rtf" })
          : new Blob([text], { type: "text/plain" }),
      );
    } catch {
      setFailure(`The note could not be saved as “${target.name}”.`);
    }
  };
  const exporting = dialog?.kind === "export" ? dialog : null;
  return (
    <>
      {dialog?.kind === "import"
        ? createPortal(
            <div className="mac-stickies-panel-layer">
              <DriveOpenPanel
                accept={isTextDocument}
                onOpen={(entry) => void importEntry(entry)}
                onCancel={onDone}
              />
            </div>,
            document.body,
          )
        : null}
      <Sheet open={exporting !== null} onOpenChange={(open) => open || onDone()}>
        <SheetPopup anchor={exporting?.anchor ?? undefined} width={640} aria-label="Export Text">
          {exporting ? (
            <DriveSavePanel
              defaultName={`${titleOf(exporting.text).slice(0, 60) || "Untitled"}.txt`}
              nameToSave={(typed) => exportName(typed, format)}
              onSave={(target) => void exportTo(target, exporting.text, exporting.html)}
              onCancel={onDone}
              accessory={
                <SavePanelRow label="File Format:" labelId={formatLabel}>
                  <PopUpButton
                    aria-labelledby={formatLabel}
                    value={format}
                    onValueChange={(next) => setFormat(next as ExportFormat)}
                    style={{ width: 252 }}
                  >
                    <PopUpButtonItem value="plain">Plain Text</PopUpButtonItem>
                    <PopUpButtonItem value="rtf">Rich Text Format (RTF)</PopUpButtonItem>
                    <PopUpButtonItem value="rtfd" disabled title={NO_RTFD}>
                      Rich Text Format Directory (RTFD)
                    </PopUpButtonItem>
                  </PopUpButton>
                </SavePanelRow>
              }
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      <Alert open={failure !== null} onOpenChange={(open) => open || setFailure(null)}>
        <AlertPopup>
          <AlertMessage>{failure}</AlertMessage>
          <AlertInformativeText>Nothing was changed.</AlertInformativeText>
          <AlertButtons>
            <AlertClose render={<DefaultButton />}>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
    </>
  );
}

/** What File > Print Active Note and Print All Notes print: each note on a page of its own. */
export function printableNotes(
  notes: readonly { text: string; html?: string }[],
  page?: PageSetup,
): PrintableDocument {
  const escapeHtml = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const pageOf = (note: { text: string; html?: string }) =>
    note.html ??
    note.text
      .split("\n")
      .map((line) => `<div>${escapeHtml(line) || "<br>"}</div>`)
      .join("");
  return {
    name: titleOf(notes[0]?.text ?? "") || "Stickies",
    lines: notes.flatMap((note) => note.text.split("\n")),
    plain: false,
    ...(page ? { page } : {}),
    html: notes
      .map((note, index) =>
        index < notes.length - 1
          ? `<div style="break-after:page">${pageOf(note)}</div>`
          : pageOf(note),
      )
      .join(""),
  };
}
