"use client";

import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { TextField } from "macalicious/text-field";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadDrive } from "../desktop/desktop-files";
import { DriveOpenPanel } from "../finder/finder-file-dialogs";
import {
  type FileKind,
  fileIsKind,
  mediaOnDrive,
  type PageAnswer,
  type PageQuestion,
  type WorkflowVariable,
} from "./automator-page";
import { type FileItem, startedText, type WorkflowVersion } from "./automator-server";

const OPTION_COLUMN: readonly TableViewColumn[] = [{ id: "option" }];

const versionText = (version: WorkflowVersion | undefined) => {
  if (!version) return "";
  const count = version.workflow.steps.length;
  return `${startedText(version.savedMs)}: ${version.workflow.name}, ${count} ${count === 1 ? "action" : "actions"}`;
};

function TextQuestion({
  question,
  anchor,
  onAnswer,
}: {
  question: Extract<PageQuestion, { kind: "text" }>;
  anchor: HTMLElement | null;
  onAnswer: (answer: PageAnswer | null) => void;
}) {
  const [text, setText] = useState(question.value);
  const refused = question.required && text.trim() === "";
  const answer = () => {
    if (!refused) onAnswer({ text });
  };
  return (
    <Sheet open onOpenChange={(open) => open || onAnswer(null)}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>{question.question}</SheetTitle>
        <TextField
          aria-label="Your answer"
          type={question.secret ? "password" : undefined}
          value={text}
          onValueChange={setText}
          onKeyDown={(event) => {
            if (event.key === "Enter") answer();
          }}
        />
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton disabled={refused} onClick={answer}>
            OK
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

function ChooseQuestion({
  question,
  anchor,
  onAnswer,
}: {
  question: Extract<PageQuestion, { kind: "choose" }>;
  anchor: HTMLElement | null;
  onAnswer: (answer: PageAnswer | null) => void;
}) {
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const { options } = question;
  return (
    <Sheet open onOpenChange={(open) => open || onAnswer(null)}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>{question.prompt}</SheetTitle>
        <TableView
          aria-label="Choices"
          className="mac-automator-open-list"
          columns={OPTION_COLUMN}
          header="none"
          selectionMode={question.several ? "multiple" : undefined}
          rowCount={options.length}
          rowHeight={19}
          size="mini"
          getRowId={(row) => options[row] ?? row}
          getRowLabel={(row) => options[row] ?? ""}
          value={chosen}
          onValueChange={(value) => setChosen(value.map(String))}
          renderCell={(row) => options[row] ?? null}
        />
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton
            disabled={chosen.length === 0}
            onClick={() => onAnswer({ chosen: [...chosen] })}
          >
            OK
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** What the window asks the person while a page action runs. */
export function PageQuestionSheet({
  question,
  anchor,
  onAnswer,
}: {
  question: PageQuestion;
  anchor: HTMLElement | null;
  onAnswer: (answer: PageAnswer | null) => void;
}) {
  if (question.kind === "text") {
    return <TextQuestion question={question} anchor={anchor} onAnswer={onAnswer} />;
  }
  if (question.kind === "choose") {
    return <ChooseQuestion question={question} anchor={anchor} onAnswer={onAnswer} />;
  }
  if (question.kind === "media") {
    return (
      <MediaBrowserSheet
        only={question.accept}
        anchor={anchor}
        onAdd={(paths) => onAnswer({ chosen: [...paths] })}
        onClose={() => onAnswer(null)}
      />
    );
  }
  if (question.kind === "file") {
    return createPortal(
      <div className="mac-automator-panel-layer">
        <DriveOpenPanel
          accept={(entry) => fileIsKind(entry, question.accept) === true}
          chooseFolders={question.accept === "any"}
          defaultFolder={question.folder}
          multiple
          onCancel={() => onAnswer(null)}
          onOpen={(files) => onAnswer({ files })}
        />
      </div>,
      document.body,
    );
  }
  return (
    <Sheet open onOpenChange={(open) => open || onAnswer(null)}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>{question.title}</SheetTitle>
        {question.message ? <SheetDescription>{question.message}</SheetDescription> : null}
        <SheetActions>
          <PushButton onClick={() => onAnswer(null)}>{question.cancel}</PushButton>
          <DefaultButton onClick={() => onAnswer(true)}>{question.confirm}</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

const MEDIA_KINDS: readonly (readonly [string, FileKind])[] = [
  ["Audio", "song"],
  ["Movies", "movie"],
  ["Photos", "photo"],
];

/**
 * The songs, movies and pictures on the person's drive, wherever they are, which includes those Music
 * and Photos keep there: View > Media Browser, a panel beside the workflow, or with `only` an Ask
 * action's sheet of one kind.
 */
export function MediaBrowserSheet({
  only,
  anchor,
  onAdd,
  onClose,
}: {
  /** Lists this kind alone, for an Ask action, whose list answers it. */
  only?: FileKind;
  anchor: HTMLElement | null;
  onAdd: (paths: readonly string[]) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<FileKind>(only ?? "song");
  const [media, setMedia] = useState<readonly FileItem[] | null>(null);
  const [problem, setProblem] = useState("");
  const [chosen, setChosen] = useState<readonly string[]>([]);
  useEffect(() => {
    let live = true;
    setMedia(null);
    setChosen([]);
    loadDrive().then(
      (drive) => {
        if (live) setMedia(mediaOnDrive(drive, kind));
      },
      (error: unknown) => {
        if (live) setProblem(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      live = false;
    };
  }, [kind]);
  const list = media ?? [];
  useEffect(() => {
    if (only) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [only, onClose]);
  const note = problem
    ? `Your drive could not be read: ${problem}`
    : media === null
      ? "Reading your drive…"
      : list.length === 0
        ? "Your drive has none of these."
        : only
          ? "Choose what the workflow goes on with."
          : "Add to Workflow puts the chosen files in a Get Specified Finder Items step.";
  const table = (
    <TableView
      aria-label="Media"
      className="mac-automator-open-list"
      columns={OPTION_COLUMN}
      header="none"
      selectionMode="multiple"
      rowCount={list.length}
      rowHeight={19}
      size="mini"
      getRowId={(row) => list[row]?.path ?? row}
      getRowLabel={(row) => list[row]?.path ?? ""}
      value={chosen}
      onValueChange={(value) => setChosen(value.map(String))}
      renderCell={(row) => list[row]?.path ?? null}
    />
  );
  if (!only) {
    return (
      <div role="dialog" aria-label="Media Browser" className="mac-automator-media-panel">
        <Label textStyle="headline">Media Browser</Label>
        <SegmentedControl
          aria-label="Kind of media"
          value={[kind]}
          onValueChange={([next]) => {
            if (next) setKind(next as FileKind);
          }}
        >
          {MEDIA_KINDS.map(([label, each]) => (
            <Segment key={each} value={each}>
              {label}
            </Segment>
          ))}
        </SegmentedControl>
        <Label textStyle="small" color="secondary">
          {note}
        </Label>
        {table}
        <div className="mac-automator-media-actions">
          <PushButton onClick={onClose}>Close</PushButton>
          <DefaultButton disabled={chosen.length === 0} onClick={() => onAdd(chosen)}>
            Add to Workflow
          </DefaultButton>
        </div>
      </div>
    );
  }
  return (
    <Sheet open onOpenChange={(open) => open || onClose()}>
      <SheetPopup anchor={anchor} width={460}>
        <SheetTitle>Choose from your drive</SheetTitle>
        <SheetDescription>{note}</SheetDescription>
        {table}
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton disabled={chosen.length === 0} onClick={() => onAdd(chosen)}>
            OK
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** File > Revert To > Browse All Versions: the workflow's saves, newest first, to go back to one. */
export function VersionsSheet({
  name,
  versions,
  anchor,
  onRestore,
  onCancel,
}: {
  name: string;
  versions: readonly WorkflowVersion[] | null;
  anchor: HTMLElement | null;
  onRestore: (version: WorkflowVersion) => void;
  onCancel: () => void;
}) {
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const list = versions ?? [];
  const idOf = (at: number) => String(list[at]?.savedMs ?? at);
  const picked = list.find((version) => String(version.savedMs) === chosen[0]);
  return (
    <Sheet open onOpenChange={(open) => open || onCancel()}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>{`Versions of “${name}”`}</SheetTitle>
        <SheetDescription>
          {versions === null
            ? "Reading the saved versions…"
            : list.length === 0
              ? "This workflow has no kept versions yet. The next save keeps one."
              : "Restoring puts that version in the window, for you to save or leave."}
        </SheetDescription>
        <TableView
          aria-label="Versions"
          className="mac-automator-open-list"
          columns={OPTION_COLUMN}
          header="none"
          rowCount={list.length}
          rowHeight={19}
          size="mini"
          getRowId={idOf}
          getRowLabel={(row) => versionText(list[row])}
          value={chosen}
          onValueChange={(value) => setChosen(value.map(String))}
          renderCell={(row) => versionText(list[row])}
        />
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton disabled={!picked} onClick={() => picked && onRestore(picked)}>
            Restore
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** The Variables pane's New Variable… and Edit…: `name` must not be another variable's. */
export function VariableSheet({
  variable,
  taken,
  anchor,
  onDone,
  onCancel,
}: {
  variable: WorkflowVariable;
  taken: readonly string[];
  anchor: HTMLElement | null;
  onDone: (variable: WorkflowVariable) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(variable.name);
  const [value, setValue] = useState(variable.value);
  const trimmed = name.trim();
  const refused = trimmed === "" || taken.includes(trimmed);
  return (
    <Sheet open onOpenChange={(open) => open || onCancel()}>
      <SheetPopup anchor={anchor} width={360}>
        <SheetTitle>{variable.name ? `Edit “${variable.name}”` : "New Variable"}</SheetTitle>
        {taken.includes(trimmed) ? (
          <SheetDescription>This workflow has a variable of that name.</SheetDescription>
        ) : null}
        <TextField
          aria-label="Variable name"
          placeholder="Name"
          value={name}
          onValueChange={setName}
        />
        <TextField
          aria-label="Variable value"
          placeholder="Value"
          value={value}
          onValueChange={setValue}
        />
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton disabled={refused} onClick={() => onDone({ name: trimmed, value })}>
            Done
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
