import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type BatchItem, batchNames, FinderRenameField, FinderRenameItems } from "./finder-rename";

const AT = new Date(2026, 10, 2, 9, 5, 7);
const item = (id: string, name: string, parent = "p", folder = false): BatchItem => ({
  id,
  name,
  parent,
  folder,
});
const A = item("a", "Report draft.txt");
const B = item("b", "Notes draft.txt");

describe("batchNames", () => {
  it("replaces text in the name, keeping the extension and skipping what does not change", () => {
    const result = batchNames(
      [A, B, item("c", "Other.txt")],
      { mode: "replace", find: "draft", replace: "final" },
      AT,
    );
    expect(result.changes).toEqual([
      { id: "a", name: "Report final.txt" },
      { id: "b", name: "Notes final.txt" },
    ]);
    expect(result.example).toBe("Report final.txt");
    expect(result.refusal).toBeUndefined();
  });

  it("does not read an extension as part of the text to replace", () => {
    const result = batchNames([A], { mode: "replace", find: "txt", replace: "md" }, AT);
    expect(result.changes).toEqual([]);
  });

  it("adds text before or after the name, and a folder has no extension", () => {
    expect(batchNames([A], { mode: "add", text: " v2", where: "after" }, AT).example).toBe(
      "Report draft v2.txt",
    );
    expect(batchNames([A], { mode: "add", text: "Old ", where: "before" }, AT).example).toBe(
      "Old Report draft.txt",
    );
    const folder = item("f", "v1.2", "p", true);
    expect(batchNames([folder], { mode: "add", text: " old", where: "after" }, AT).example).toBe(
      "v1.2 old",
    );
  });

  it("numbers by index and by counter from the given start", () => {
    const names = (format: "index" | "counter") =>
      batchNames(
        [A, B],
        { mode: "format", format, where: "after", custom: "Item", start: 9 },
        AT,
      ).changes.map(({ name }) => name);
    expect(names("index")).toEqual(["Item 9.txt", "Item 10.txt"]);
    expect(names("counter")).toEqual(["Item 00009.txt", "Item 00010.txt"]);
  });

  it("dates every item with a name of its own", () => {
    const { changes, refusal } = batchNames(
      [A, B],
      { mode: "format", format: "date", where: "before", custom: "Scan", start: 1 },
      AT,
    );
    expect(refusal).toBeUndefined();
    expect(changes.map(({ name }) => name)).toEqual([
      "2026-11-02 at 09.05.07 Scan.txt",
      "2026-11-02 at 09.05.07 2 Scan.txt",
    ]);
  });

  it("leaves a name alone that the rule does not touch, spaces and all", () => {
    const odd = item("o", " Report .txt");
    for (const rule of [
      { mode: "replace", find: "", replace: "x" },
      { mode: "replace", find: "absent", replace: "x" },
      { mode: "add", text: "", where: "after" },
    ] as const) {
      expect(batchNames([odd], rule, AT).changes).toEqual([]);
    }
  });

  it("refuses a name of only spaces", () => {
    const result = batchNames(
      [item("a", "draft.txt")],
      { mode: "replace", find: "draft", replace: "  " },
      AT,
    );
    expect(result.refusal).toBe("A name can’t be empty.");
  });

  it("numbers with no custom format and no stray space", () => {
    const { changes } = batchNames(
      [A],
      { mode: "format", format: "index", where: "after", custom: "", start: 1 },
      AT,
    );
    expect(changes).toEqual([{ id: "a", name: "1.txt" }]);
  });

  it("refuses two items of one folder with one name, and renames nothing", () => {
    const result = batchNames(
      [item("a", "One a.txt"), item("b", "One b.txt")],
      { mode: "replace", find: " b", replace: " a" },
      AT,
    );
    expect(result.refusal).toBe("Two items would be named “One a.txt”.");
    expect(result.changes).toEqual([]);
  });

  it("lets items of two folders share a name", () => {
    const result = batchNames(
      [item("a", "One a.txt", "x"), item("b", "One b.txt", "y")],
      { mode: "replace", find: " b", replace: " a" },
      AT,
    );
    expect(result.refusal).toBeUndefined();
    expect(result.changes).toEqual([{ id: "b", name: "One a.txt" }]);
  });

  it("refuses an empty name", () => {
    const result = batchNames(
      [item("a", "draft.txt")],
      { mode: "replace", find: "draft", replace: "" },
      AT,
    );
    expect(result.refusal).toBe("A name can’t be empty.");
    expect(result.changes).toEqual([]);
  });
});

describe("renaming in place", () => {
  function setup(name = "Plan.txt", folder = false) {
    const onRename = vi.fn();
    const onClose = vi.fn();
    render(
      <FinderRenameField
        name={name}
        folder={folder}
        locate={() => document.body}
        container={document.body}
        onRename={onRename}
        onClose={onClose}
      />,
    );
    const field = screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement;
    return { onRename, onClose, field };
  }

  it("has the keyboard, with the name selected before its extension", () => {
    const { field } = setup();
    expect(field).toHaveFocus();
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 4]);
  });

  it("selects a whole folder name, dot and all", () => {
    const { field } = setup("v1.2", true);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 4]);
  });

  it("keeps the new name on Return, once", async () => {
    const user = userEvent.setup();
    const { field, onRename, onClose } = setup();
    await user.clear(field);
    await user.type(field, "Final.txt{Enter}");
    field.blur();
    expect(onRename.mock.calls).toEqual([["Final.txt", true]]);
    expect(onClose.mock.calls).toEqual([[true]]);
  });

  it("keeps the new name when the field is left", async () => {
    const user = userEvent.setup();
    const { field, onRename, onClose } = setup();
    await user.clear(field);
    await user.type(field, "Final.txt");
    field.blur();
    expect(onRename.mock.calls).toEqual([["Final.txt", false]]);
    expect(onClose.mock.calls).toEqual([[false]]);
  });

  it("keeps the old name on Escape", async () => {
    const user = userEvent.setup();
    const { field, onRename, onClose } = setup();
    await user.clear(field);
    await user.type(field, "Final.txt{Escape}");
    expect(onRename).not.toHaveBeenCalled();
    expect(onClose.mock.calls).toEqual([[true]]);
  });

  it("renames nothing for an unchanged or an empty name", async () => {
    const user = userEvent.setup();
    const unchanged = setup();
    await user.keyboard("{Enter}");
    expect(unchanged.onRename).not.toHaveBeenCalled();
    expect(unchanged.onClose).toHaveBeenCalledTimes(1);
  });

  it("renames nothing for an empty name", async () => {
    const user = userEvent.setup();
    const { field, onRename, onClose } = setup();
    await user.clear(field);
    await user.keyboard("{Enter}");
    expect(onRename).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves Return and Escape to an input method while it composes", () => {
    const { field, onRename, onClose } = setup();
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    fireEvent.keyDown(field, { key: "Escape", isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(onRename).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "名前.txt" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onRename.mock.calls).toEqual([["名前.txt", true]]);
  });

  it("keeps its keys from the window", async () => {
    const user = userEvent.setup();
    const heard = vi.fn();
    document.addEventListener("keydown", heard);
    setup();
    await user.keyboard("a");
    document.removeEventListener("keydown", heard);
    expect(heard).not.toHaveBeenCalled();
  });
});

describe("Rename N Items", () => {
  it("sends the names that change, and closes", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onClose = vi.fn();
    render(<FinderRenameItems items={[A, B]} onRename={onRename} onClose={onClose} />);
    await user.type(await screen.findByRole("textbox", { name: "Find" }), "draft");
    await user.type(screen.getByRole("textbox", { name: "Replace with" }), "final");
    expect(screen.getByText("Example: Report final.txt")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rename" }));
    expect(onRename).toHaveBeenCalledWith([
      { id: "a", name: "Report final.txt" },
      { id: "b", name: "Notes final.txt" },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("says why it cannot rename, and offers no Rename", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(
      <FinderRenameItems
        items={[item("a", "One a.txt"), item("b", "One b.txt")]}
        onRename={onRename}
        onClose={() => {}}
      />,
    );
    await user.type(await screen.findByRole("textbox", { name: "Find" }), " b");
    await user.type(screen.getByRole("textbox", { name: "Replace with" }), " a");
    expect(screen.getByRole("alert")).toHaveTextContent("Two items would be named");
    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();
  });
});
