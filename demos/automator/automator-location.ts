import {
  DriveError,
  entryOf,
  inTrash,
  loadDrive,
  pathOf,
  runOps,
  uploadFile,
} from "../desktop/desktop-files";
import { type DriveSaveTarget, saveToDrive } from "../finder/finder-file-dialogs";
import {
  changeLocation,
  fileNameOf,
  loadLocations,
  type WorkflowDraft,
  workflowFileText,
} from "./automator-server";

/*
 * File > Move To…: the workflow as a file in a folder of the drive. The server's copy stays where it
 * was, because that is what a folder, a calendar alarm or the Services menu starts; the file is kept
 * the same at each save, and the server remembers which file it is (`/api/automator/locations`), by
 * its id, so it can go on moving in Finder and opening it opens this workflow.
 */

const blobOf = (draft: WorkflowDraft) =>
  new Blob([workflowFileText(draft)], { type: "application/json" });

/** Moves the workflow's file, or writes it the first time. Answers the file's path. */
export async function moveWorkflowFile(
  draft: WorkflowDraft,
  target: DriveSaveTarget,
  known: readonly string[],
): Promise<string> {
  const placed = (await loadLocations()).files[draft.id];
  const drive = await loadDrive();
  const present = placed && entryOf(drive, placed) && !inTrash(drive, placed) ? placed : null;
  const file = present ?? (await saveToDrive(target, blobOf(draft))).id;
  if (present && target.replaces?.id !== present) {
    await runOps(
      [
        {
          op: "move",
          id: present,
          parent: target.folder,
          name: target.name,
          existing: target.replaces ? "replace" : "fail",
        },
      ],
      undefined,
      target.session,
    );
  }
  await changeLocation(draft.id, file, known);
  return pathOf(await loadDrive(), file)
    .slice(0, -1)
    .map((folder) => folder.name)
    .join("/");
}

/** After a save: the workflow's file holds it too, under its name. A file gone is forgotten. */
export async function saveWorkflowFile(
  draft: WorkflowDraft,
  known: readonly string[],
  session?: string | null,
): Promise<void> {
  const placed = (await loadLocations()).files[draft.id];
  if (!placed) return;
  const drive = await loadDrive();
  const entry = entryOf(drive, placed);
  if (!entry || inTrash(drive, placed)) {
    await changeLocation(draft.id, null, known);
    return;
  }
  try {
    await uploadFile(blobOf(draft), entry.parent ?? "", {
      name: entry.name,
      existing: "overwrite",
      replaces: placed,
      session,
    });
  } catch (error) {
    if (!(error instanceof DriveError) || error.status !== 409) throw error;
    await changeLocation(draft.id, null, known);
    return;
  }
  const name = fileNameOf(draft.name, draft.kind);
  if (name !== entry.name) {
    await runOps([{ op: "rename", id: placed, name }], undefined, session ?? undefined);
  }
}

/** The workflow a drive file is the moved file of, if it is one. */
export async function workflowOfFile(file: string): Promise<string | null> {
  const { files } = await loadLocations();
  return Object.keys(files).find((id) => files[id] === file) ?? null;
}
