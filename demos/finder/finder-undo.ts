import { useSyncExternalStore } from "react";
import {
  currentDrive,
  type Drive,
  DriveError,
  type DriveOp,
  entryOf,
  runOps,
} from "../desktop/desktop-files";
import { desktopPictureGeneration, subscribeDesktopPicture } from "../desktop/desktop-personal";
import { currentDesktopSession } from "../desktop/desktop-server";

/**
 * Finder's Undo and Redo: one stack for every Finder window, as a Mac has, lost with the page. A
 * step holds the drive's changes that take a command back and carry it out again. An item made by
 * a command goes to the Trash when undone and comes back when redone, so it keeps its id and the
 * steps before it still lead to it. Emptying the Trash is not undone; a step whose items went that
 * way is refused by the drive, which says why.
 */

/** What the Edit menu calls a command. */
export type UndoName =
  | "Copy"
  | "Duplicate"
  | "Move"
  | "New Folder"
  | "New Folder with Selection"
  | "Rename"
  | "Tag";

export interface UndoStep {
  /** The row's words after Undo or Redo. */
  title: string;
  undo: readonly DriveOp[];
  redo: readonly DriveOp[];
  /** The items the step is about, selected once it has run. */
  items: readonly string[];
}

const MOST_STEPS = 50;

const named = (name: UndoName, drive: Drive, ids: readonly string[]) => {
  if (name !== "Copy" && name !== "Duplicate" && name !== "Move") return name;
  if (ids.length !== 1) return `${name} of ${ids.length} Items`;
  return `${name} of “${entryOf(drive, ids[0] as string)?.name ?? "Item"}”`;
};

/**
 * The step for `ops`, which `before` was the drive before and which made the entries `created`, in
 * order. A change that is not undone (emptying the Trash, an erased item) makes no step.
 */
export function stepFor(
  name: UndoName,
  before: Drive,
  ops: readonly DriveOp[],
  created: readonly string[],
): UndoStep | null {
  const undo: DriveOp[] = [];
  const redo: DriveOp[] = [];
  const items: string[] = [];
  const sources: string[] = [];
  let made = 0;
  const keep = (op: DriveOp & { id: string }) => {
    redo.push(op);
    items.push(op.id);
    sources.push(op.id);
  };
  for (const op of ops) {
    switch (op.op) {
      case "mkdir":
      case "copy": {
        const id = created[made];
        made += 1;
        if (id === undefined) return null;
        undo.unshift({ op: "trash", id });
        if (op.op === "copy") {
          sources.push(op.id);
          const copied = op.name ?? entryOf(before, op.id)?.name;
          const replaced =
            op.existing === "replace"
              ? before.entries.find(
                  (entry) =>
                    entry.parent === op.parent &&
                    entry.name === copied &&
                    entry.trashed_ms === undefined,
                )
              : undefined;
          if (replaced) {
            undo.splice(1, 0, { op: "restore", id: replaced.id });
            redo.push({ op: "trash", id: replaced.id });
          }
        }
        redo.push({ op: "restore", id });
        items.push(id);
        break;
      }
      case "rename": {
        const entry = entryOf(before, op.id);
        if (!entry) return null;
        undo.unshift({ op: "rename", id: op.id, name: entry.name });
        keep(op);
        break;
      }
      case "move": {
        const entry = entryOf(before, op.id);
        if (!entry?.parent) return null;
        const moved = op.name ?? entry.name;
        const replaced =
          op.existing === "replace"
            ? before.entries.find(
                (other) =>
                  other.parent === op.parent &&
                  other.name === moved &&
                  other.id !== op.id &&
                  other.trashed_ms === undefined,
              )
            : undefined;
        if (replaced) undo.unshift({ op: "restore", id: replaced.id });
        undo.unshift({ op: "move", id: op.id, parent: entry.parent, name: entry.name });
        keep(op);
        break;
      }
      case "trash":
        undo.unshift({ op: "restore", id: op.id });
        keep(op);
        break;
      case "restore":
        undo.unshift({ op: "trash", id: op.id });
        keep(op);
        break;
      case "tag": {
        const entry = entryOf(before, op.id);
        if (!entry) return null;
        undo.unshift({ op: "tag", id: op.id, tags: [...(entry.tags ?? [])] });
        keep(op);
        break;
      }
      default:
        return null;
    }
  }
  if (undo.length === 0) return null;
  return { title: named(name, before, sources), undo, redo, items };
}

/** One step for two commands run one after the other, under the first one's title. */
export const joinSteps = (first: UndoStep, second: UndoStep): UndoStep => ({
  title: first.title,
  undo: [...second.undo, ...first.undo],
  redo: [...first.redo, ...second.redo],
  items: first.items,
});

interface UndoStacks {
  undo: readonly UndoStep[];
  redo: readonly UndoStep[];
}

let stacks: UndoStacks = { undo: [], redo: [] };
const listeners = new Set<() => void>();

function set(next: UndoStacks) {
  stacks = next;
  for (const listener of listeners) listener();
}

// The session the stacks belong to: a step names files and holds ids of one person's drive, so a
// session that ends takes them with it. The count of ended sessions is the desktop's own.
let session = desktopPictureGeneration();

function followSession() {
  const now = desktopPictureGeneration();
  if (now === session) return;
  session = now;
  set({ undo: [], redo: [] });
}
subscribeDesktopPicture(followSession);

// Commands and replays run one at a time, in the order they were asked for, so each step's `before`
// is the drive its own command found, and history is changed in the order the drive was.
let queue: Promise<unknown> = Promise.resolve();

/** Runs `work` after what was asked before it. A session that ended meanwhile drops it. */
function inTurn<T>(work: (asked: number) => Promise<T>): Promise<T | undefined> {
  followSession();
  const asked = session;
  const result = queue.then(() => {
    followSession();
    return asked === session ? work(asked) : undefined;
  });
  queue = result.catch(() => undefined);
  return result;
}

/** Keeps a step of `asked`'s session. What was undone before it can no longer be redone. */
function record(step: UndoStep | null, asked: number) {
  followSession();
  if (step && asked === session) {
    set({ undo: [...stacks.undo, step].slice(-MOST_STEPS), redo: [] });
  }
}

/**
 * Applies `ops` when its turn comes, and keeps them as a step of Edit's Undo under `name`. `owner` is
 * the desktop session it is for (`UploadOptions.session`): by default the page's as it is asked for.
 */
export function runUndoable(
  name: UndoName,
  ops: readonly DriveOp[],
  owner: string | null = currentDesktopSession(),
): Promise<Drive | undefined> {
  return inTurn(async (asked) => {
    const before = currentDrive();
    const drive = await runOps(ops, undefined, owner);
    if (before) record(stepFor(name, before, ops, drive.created ?? []), asked);
    return drive;
  });
}

/**
 * Runs `work`, which makes one entry, when its turn comes, and keeps it as a step: undone, the entry
 * goes to the Trash; redone, it comes back. For what is made by uploading (Compress, Make Alias).
 */
export function runMaking<T extends { id: string }>(
  title: string,
  work: () => Promise<T>,
): Promise<T | undefined> {
  return inTurn(async (asked) => {
    const made = await work();
    record(
      {
        title,
        undo: [{ op: "trash", id: made.id }],
        redo: [{ op: "restore", id: made.id }],
        items: [made.id],
      },
      asked,
    );
    return made;
  });
}

/**
 * New Folder with Selection: the folder in `parent`, then `ids` moved into it, as one step. Items the
 * drive would not move leave the folder standing, which Undo then takes back alone.
 */
export function runNewFolderWithItems(
  parent: string,
  name: string,
  ids: readonly string[],
  owner: string | null = currentDesktopSession(),
): Promise<Drive | undefined> {
  return inTurn(async (asked) => {
    const before = currentDrive();
    const mkdir: DriveOp[] = [{ op: "mkdir", parent, name }];
    const made = await runOps(mkdir, undefined, owner);
    const created = made.created?.[0];
    if (!created) return made;
    followSession();
    if (asked !== session) return made;
    const madeStep = before && stepFor("New Folder with Selection", before, mkdir, [created]);
    const moves: DriveOp[] = ids.map((id) => ({ op: "move", id, parent: created }));
    try {
      const moved = await runOps(moves, undefined, owner);
      const movedStep = stepFor("Move", made, moves, []);
      record(madeStep && movedStep ? joinSteps(madeStep, movedStep) : madeStep, asked);
      return { ...moved, created: [created] };
    } catch (error) {
      record(madeStep, asked);
      throw error;
    }
  });
}

/** The latest step of a direction, whichever window asks. */
export function useFinderUndo(): { undo: UndoStep | null; redo: UndoStep | null } {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => stacks,
    () => stacks,
  );
  return { undo: current.undo.at(-1) ?? null, redo: current.redo.at(-1) ?? null };
}

/**
 * Takes back or carries out again the latest step, when its turn comes. A step the drive refuses goes
 * from the stack, in words about the step when its items have gone. One whose request got no
 * definite answer stays to be tried again: each of its changes reaches the same result twice, or is
 * refused when it had already gone through.
 */
export function replayStep(
  direction: "undo" | "redo",
  owner: string | null = currentDesktopSession(),
): Promise<{ drive: Drive; items: readonly string[] } | undefined> {
  return inTurn(async (asked) => {
    const step = stacks[direction].at(-1);
    if (!step) return undefined;
    const other = direction === "undo" ? "redo" : "undo";
    const without = () => stacks[direction].filter((each) => each !== step);
    const word = direction === "undo" ? "Undo" : "Redo";
    try {
      const drive = await runOps(step[direction], undefined, owner);
      followSession();
      if (asked === session) {
        set({ ...stacks, [direction]: without(), [other]: [...stacks[other], step] } as UndoStacks);
      }
      return { drive, items: step.items };
    } catch (error) {
      followSession();
      const refused = error instanceof DriveError && error.status >= 400 && error.status < 500;
      if (!refused) throw error;
      if (asked === session) set({ ...stacks, [direction]: without() } as UndoStacks);
      throw error.status === 404
        ? new DriveError(
            404,
            `${word} ${step.title} can’t be done: an item it changes is no longer on the drive.`,
          )
        : error;
    }
  });
}
