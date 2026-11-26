import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotesContent } from "./notes";
import { listKindHistory } from "./notes-list-history";
import { NotesPhotos } from "./notes-photos";

const library = vi.hoisted(() => ({
  loadLibrary: vi.fn(),
  readThumbs: vi.fn(async () => new Map<string, Blob>()),
}));
vi.mock("../photos/photos-library", async (original) => ({
  ...(await original<typeof import("../photos/photos-library")>()),
  ...library,
}));

const editorWith = (html: string) => {
  const editor = document.createElement("div");
  editor.innerHTML = html;
  document.body.append(editor);
  return editor;
};
const list = (editor: HTMLElement) => editor.querySelector("ul") as HTMLElement;

describe("Undo and Redo of a list's kind", () => {
  it("take a change of kind back and forth, and nothing else", () => {
    const editor = editorWith("<ul><li>one</li></ul>");
    const kinds = listKindHistory(editor);
    expect(kinds.take("undo"), "nothing to take yet").toBe(false);
    const before = kinds.kinds();
    list(editor).className = "mac-notes-dashed";
    kinds.changed(before);
    expect(kinds.take("undo")).toBe(true);
    expect(list(editor).getAttribute("class")).toBeNull();
    expect(kinds.take("undo"), "the rest is the browser's").toBe(false);
    expect(kinds.take("redo")).toBe(true);
    expect(list(editor).getAttribute("class")).toBe("mac-notes-dashed");
  });

  it("stand aside once the text has changed since", () => {
    const editor = editorWith("<ul><li>one</li></ul>");
    const kinds = listKindHistory(editor);
    const before = kinds.kinds();
    list(editor).className = "mac-notes-checklist";
    kinds.changed(before);
    (editor.querySelector("li") as HTMLElement).textContent = "one more";
    expect(kinds.take("undo")).toBe(false);
    expect(list(editor).getAttribute("class")).toBe("mac-notes-checklist");
  });

  it("are told apart from the browser's own, whose list comes back with its kind", () => {
    const editor = editorWith("<ul class='mac-notes-dashed'><li>one</li></ul>");
    listKindHistory(editor).note();
    list(editor).removeAttribute("class");
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "historyUndo" }));
    expect(list(editor).getAttribute("class")).toBe("mac-notes-dashed");
  });
});

describe("Media > Photos…", () => {
  const photo = {
    id: "p1",
    file: "drive-1",
    mime: "image/png",
    bytes: 10,
    title: "Harbor",
    deleted_ms: null,
    hidden: false,
    taken_ms: 5,
  };

  it("lists the library and hands over the picture chosen, as a file of the drive", async () => {
    library.loadLibrary.mockResolvedValue({ photos: [photo] });
    const chosen = vi.fn();
    const closed = vi.fn();
    render(
      <NotesPhotos anchor={null} onChoose={chosen} onFromComputer={vi.fn()} onClose={closed} />,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Harbor/ }));
    expect(chosen.mock.calls[0]?.[0]).toMatchObject({ id: "drive-1", type: "image/png" });
    expect(closed).toHaveBeenCalledOnce();
  });

  it("says so when the library has nothing, or cannot be read", async () => {
    library.loadLibrary.mockResolvedValue({ photos: [] });
    const { unmount } = render(
      <NotesPhotos anchor={null} onChoose={vi.fn()} onFromComputer={vi.fn()} onClose={vi.fn()} />,
    );
    await screen.findByText("No Photos");
    unmount();
    library.loadLibrary.mockRejectedValue(new Error("down"));
    render(
      <NotesPhotos anchor={null} onChoose={vi.fn()} onFromComputer={vi.fn()} onClose={vi.fn()} />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your Photos library could not be read.",
    );
  });
});

describe("the sidebar without On My Mac", () => {
  it("lists iCloud alone until the account is turned on", async () => {
    render(<NotesContent />);
    await act(async () => {});
    await waitFor(() => expect(screen.getByText("iCloud")).toBeInTheDocument());
    expect(screen.queryByText("On My Mac")).toBeNull();
  });
});
