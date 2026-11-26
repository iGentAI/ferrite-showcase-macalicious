import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Drive, DriveEntry, DriveOp } from "../desktop/desktop-files";

const drive = vi.hoisted(() => ({
  current: null as Drive | null,
  run: (async () => ({})) as unknown as (ops: readonly DriveOp[]) => Promise<Drive>,
}));

vi.mock("../desktop/desktop-files", async (original) => ({
  ...(await original<typeof import("../desktop/desktop-files")>()),
  currentDrive: () => drive.current,
  runOps: (ops: readonly DriveOp[]) => drive.run(ops),
}));

const { joinSteps, replayStep, runNewFolderWithItems, runUndoable, stepFor, useFinderUndo } =
  await import("./finder-undo");
const { DriveError } = await import("../desktop/desktop-files");
const { forgetDesktopValues } = await import("../desktop/desktop-personal");
const { renderHook } = await import("@testing-library/react");

const entry = (id: string, parent: string, name: string, more: Partial<DriveEntry> = {}) =>
  ({ id, parent, name, kind: "file", ...more }) as DriveEntry;

const before = {
  entries: [
    entry("a", "documents", "a.txt", { tags: ["Red"] }),
    entry("b", "documents", "b.txt"),
    entry("c", "pictures", "a.txt"),
  ],
} as Drive;

describe("an undo step", () => {
  it("moves an item back under the name it had", () => {
    expect(
      stepFor("Move", before, [{ op: "move", id: "a", parent: "pictures", name: "z.txt" }], []),
    ).toEqual({
      title: "Move of “a.txt”",
      undo: [{ op: "move", id: "a", parent: "documents", name: "a.txt" }],
      redo: [{ op: "move", id: "a", parent: "pictures", name: "z.txt" }],
      items: ["a"],
    });
  });

  it("counts several items, and undoes the last change first", () => {
    const step = stepFor(
      "Rename",
      before,
      [
        { op: "rename", id: "b", name: "c.txt" },
        { op: "rename", id: "a", name: "b.txt" },
      ],
      [],
    );
    expect(step?.undo).toEqual([
      { op: "rename", id: "a", name: "a.txt" },
      { op: "rename", id: "b", name: "b.txt" },
    ]);
    expect(
      stepFor(
        "Move",
        before,
        [
          { op: "trash", id: "a" },
          { op: "trash", id: "b" },
        ],
        [],
      )?.title,
    ).toBe("Move of 2 Items");
  });

  it("puts back what went to the Trash, and trashes what was put back", () => {
    expect(stepFor("Move", before, [{ op: "trash", id: "a" }], [])?.undo).toEqual([
      { op: "restore", id: "a" },
    ]);
    expect(stepFor("Move", before, [{ op: "restore", id: "a" }], [])?.undo).toEqual([
      { op: "trash", id: "a" },
    ]);
  });

  it("sends a made item to the Trash and brings the same item back", () => {
    expect(
      stepFor("New Folder", before, [{ op: "mkdir", parent: "documents", name: "f" }], ["new"]),
    ).toEqual({
      title: "New Folder",
      undo: [{ op: "trash", id: "new" }],
      redo: [{ op: "restore", id: "new" }],
      items: ["new"],
    });
  });

  it("brings back what a copy replaced", () => {
    const step = stepFor(
      "Copy",
      before,
      [{ op: "copy", id: "a", parent: "pictures", existing: "replace" }],
      ["new"],
    );
    expect(step?.title).toBe("Copy of “a.txt”");
    expect(step?.undo).toEqual([
      { op: "trash", id: "new" },
      { op: "restore", id: "c" },
    ]);
    expect(step?.redo).toEqual([
      { op: "trash", id: "c" },
      { op: "restore", id: "new" },
    ]);
  });

  it("brings back what a move replaced", () => {
    const step = stepFor(
      "Move",
      before,
      [{ op: "move", id: "a", parent: "pictures", existing: "replace" }],
      [],
    );
    expect(step?.undo).toEqual([
      { op: "move", id: "a", parent: "documents", name: "a.txt" },
      { op: "restore", id: "c" },
    ]);
  });

  it("sets the tags an item had, none included", () => {
    expect(stepFor("Tag", before, [{ op: "tag", id: "a", tags: ["Blue"] }], [])?.undo).toEqual([
      { op: "tag", id: "a", tags: ["Red"] },
    ]);
    expect(stepFor("Tag", before, [{ op: "tag", id: "b", tags: ["Blue"] }], [])?.undo).toEqual([
      { op: "tag", id: "b", tags: [] },
    ]);
  });

  it("makes no step for a change that is not undone", () => {
    expect(stepFor("Move", before, [{ op: "empty-trash" }], [])).toBeNull();
    expect(stepFor("Move", before, [{ op: "delete", id: "a" }], [])).toBeNull();
  });

  it("joins a folder and the items moved into it, undone in reverse", () => {
    const made = stepFor(
      "New Folder with Selection",
      before,
      [{ op: "mkdir", parent: "documents", name: "f" }],
      ["new"],
    );
    const moved = stepFor("Move", before, [{ op: "move", id: "a", parent: "new" }], []);
    if (!made || !moved) throw new Error("no step");
    expect(joinSteps(made, moved)).toEqual({
      title: "New Folder with Selection",
      undo: [
        { op: "move", id: "a", parent: "documents", name: "a.txt" },
        { op: "trash", id: "new" },
      ],
      redo: [
        { op: "restore", id: "new" },
        { op: "move", id: "a", parent: "new" },
      ],
      items: ["new"],
    });
  });
});

const latest = () => {
  const { result, unmount } = renderHook(() => useFinderUndo());
  const value = result.current;
  unmount();
  return value;
};

/** A drive that applies tag changes and answers each when `release` is called, in order. */
function tagDrive(start: readonly string[]) {
  let tags = [...start];
  const seen: DriveOp[][] = [];
  const held: (() => void)[] = [];
  drive.current = { entries: [entry("a", "documents", "a.txt", { tags })] } as Drive;
  drive.run = (ops) =>
    new Promise((resolve) => {
      seen.push([...ops]);
      held.push(() => {
        for (const op of ops) if (op.op === "tag") tags = [...op.tags];
        drive.current = { entries: [entry("a", "documents", "a.txt", { tags })] } as Drive;
        resolve(drive.current);
      });
    });
  const release = async () => {
    await vi.waitFor(() => expect(held.length).toBeGreaterThan(0));
    held.shift()?.();
  };
  return { seen, release, tags: () => tags };
}

describe("the undo stack", () => {
  beforeEach(() => {
    // Each test starts on a session of its own, with empty stacks.
    forgetDesktopValues();
    drive.current = before;
    drive.run = async (ops) => ({ ...before, created: ops.map((_, index) => `new${index}`) });
  });

  it("runs two quick changes in turn, so each undo gives back the state before it", async () => {
    const { release, tags, seen } = tagDrive(["Red"]);
    const first = runUndoable("Tag", [{ op: "tag", id: "a", tags: ["Blue"] }]);
    const second = runUndoable("Tag", [{ op: "tag", id: "a", tags: ["Green"] }]);
    await release();
    await first;
    await release();
    await second;
    expect(tags()).toEqual(["Green"]);
    const undoSecond = replayStep("undo");
    await release();
    await undoSecond;
    expect(tags()).toEqual(["Blue"]);
    const undoFirst = replayStep("undo");
    await release();
    await undoFirst;
    expect(tags()).toEqual(["Red"]);
    expect(seen).toHaveLength(4);
  });

  it("loses Redo to a change asked for while an undo runs", async () => {
    await runUndoable("Move", [{ op: "trash", id: "a" }]);
    const { release } = tagDrive([]);
    const undo = replayStep("undo");
    const change = runUndoable("Tag", [{ op: "tag", id: "a", tags: ["Blue"] }]);
    await release();
    await undo;
    await release();
    await change;
    expect(latest().redo).toBeNull();
    expect(latest().undo?.title).toBe("Tag");
  });

  it("keeps a step whose request got no answer, so it can be tried again", async () => {
    await runUndoable("Move", [{ op: "trash", id: "a" }]);
    drive.run = async () => {
      throw new DriveError(0, "The drive could not be reached.");
    };
    await expect(replayStep("undo")).rejects.toThrow("could not be reached");
    expect(latest().undo?.title).toBe("Move of “a.txt”");
    drive.run = async () => before;
    await expect(replayStep("undo")).resolves.toEqual({ drive: before, items: ["a"] });
    expect(latest().undo).toBeNull();
    expect(latest().redo?.title).toBe("Move of “a.txt”");
  });

  it("drops a step whose item has gone, and says which", async () => {
    await runUndoable("Move", [{ op: "trash", id: "a" }]);
    drive.run = async () => {
      throw new DriveError(404, "no item has the id a");
    };
    await expect(replayStep("undo")).rejects.toThrow(
      "Undo Move of “a.txt” can’t be done: an item it changes is no longer on the drive.",
    );
    expect(latest().undo).toBeNull();
  });

  it("ends with the session, and a change still going does not bring it back", async () => {
    await runUndoable("Move", [{ op: "trash", id: "a" }]);
    expect(latest().undo).not.toBeNull();
    const { release, seen } = tagDrive([]);
    const going = runUndoable("Tag", [{ op: "tag", id: "a", tags: ["Blue"] }]);
    const waiting = runUndoable("Tag", [{ op: "tag", id: "a", tags: ["Green"] }]);
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    forgetDesktopValues();
    expect(latest().undo).toBeNull();
    await release();
    await going;
    await expect(waiting).resolves.toBeUndefined();
    expect(seen).toHaveLength(1);
    expect(latest().undo).toBeNull();
  });

  it("moves nothing into a new folder once the session has ended", async () => {
    const seen: DriveOp[][] = [];
    let answer: (drive: Drive) => void = () => {};
    drive.run = (ops) => {
      seen.push([...ops]);
      return new Promise((resolve) => {
        answer = resolve;
      });
    };
    const going = runNewFolderWithItems("documents", "New", ["a"]);
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    forgetDesktopValues();
    answer({ ...before, created: ["folder"] });
    await going;
    expect(seen).toHaveLength(1);
    expect(latest().undo).toBeNull();
  });

  it("undoes New Folder with Selection as one step, the folder alone when the move fails", async () => {
    drive.run = async (ops) => ({
      ...before,
      created: ops[0]?.op === "mkdir" ? ["folder"] : [],
    });
    await runNewFolderWithItems("documents", "New", ["a"]);
    expect(latest().undo?.title).toBe("New Folder with Selection");
    forgetDesktopValues();
    drive.run = async (ops) => {
      if (ops[0]?.op === "mkdir") return { ...before, created: ["folder"] };
      throw new DriveError(409, "no");
    };
    await expect(runNewFolderWithItems("documents", "New", ["a"])).rejects.toThrow("no");
    expect(latest().undo?.undo).toEqual([{ op: "trash", id: "folder" }]);
  });
});
