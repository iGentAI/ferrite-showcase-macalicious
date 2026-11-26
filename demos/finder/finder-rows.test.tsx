import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { beginDesktopDrag, registerDropTarget } from "../desktop/desktop-drag";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { Finder } from "./finder";
import { createFileSystem, type FinderEntry, HOME, sortEntries } from "./finder-data";
import {
  FINDER_INFO_HOST,
  FinderInfo,
  FinderSummaryInfo,
  sharedTags,
  withSharedTags,
} from "./finder-info";
import { FinderQuickLook } from "./finder-quick-look";
import { FINDER_SIDEBAR_ORDER, inSidebarOrder } from "./finder-saved";
import { FinderViewOptions } from "./finder-view-options";

const root = createFileSystem();
const PICTURE = `${HOME}/Downloads/10-9.jpg`;

/** jsdom lays nothing out: what `document.elementFromPoint` answers for this test. */
function answerPoint(element: Element) {
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => element,
  });
}

afterEach(() => {
  Reflect.deleteProperty(document, "elementFromPoint");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const made = 1_700_000_000_000;
const folder = { kind: "folder", size: 0, version: 0, created_ms: made, modified_ms: made };
const file = (id: string, name: string, more: object = {}) => ({
  ...folder,
  id,
  parent: "documents",
  kind: "file",
  name,
  type: "text/plain",
  size: 5,
  ...more,
});

/** The served drive, a stand-in for the desktop's application: the ops it took are in `ops`. */
function serveDrive(entries: object[]) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const ops: Record<string, unknown>[] = [];
  const drive = {
    rev: 1,
    usage: 5,
    quota: 1_000_000,
    piece_bytes: 1000,
    max_file_bytes: 1000,
    max_entries: 100,
    entries: [{ ...folder, id: "documents", name: "Documents" }, ...entries],
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (String(url).startsWith("/api/files/ops")) {
      ops.push(...(JSON.parse(String(init?.body)) as { ops: Record<string, unknown>[] }).ops);
    }
    return String(url).startsWith("/api/files")
      ? new Response(JSON.stringify(drive), { status: 200 })
      : new Response("{}", { status: 200 });
  });
  return ops;
}

describe("the list's Comments column", () => {
  const entry = (name: string, comment?: string): FinderEntry => ({
    path: `/${name}`,
    node: { name, kind: "file", comment },
  });

  it("sorts by the comment, with those without one last", () => {
    const sorted = sortEntries([entry("a"), entry("b", "zebra"), entry("c", "apple")], {
      column: "comments",
      direction: "ascending",
    });
    expect(sorted.map(({ node }) => node.name)).toEqual(["c", "b", "a"]);
  });

  it("is chosen in View Options, where Date Added and Version each say why they are dimmed", async () => {
    const onKeep = vi.fn();
    render(
      <FinderViewOptions
        folder="Documents"
        view="list"
        sorts={[]}
        settings={{}}
        alwaysOpens={false}
        iconSize={64}
        sortColumn="name"
        previewShown
        onPreviewChange={() => {}}
        onKeep={onKeep}
        onUseAsDefaults={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Comments" }));
    expect(onKeep).toHaveBeenCalledWith({ columns: ["modified", "size", "kind", "comments"] });
    expect(screen.getByRole("checkbox", { name: "Date Added" })).toHaveAttribute(
      "title",
      "The drive does not keep when an item arrived in its folder.",
    );
    expect(screen.getByRole("checkbox", { name: "Version" })).toHaveAttribute(
      "title",
      "The drive’s files have no versions; only an application has one.",
    );
  });
});

describe("a Finder window's contextual menus", () => {
  it("offers Clean Up, Clean Up By and View Options on the background", async () => {
    render(<Finder />);
    const items = screen.getByRole("listbox");
    fireEvent.contextMenu(items);
    const cleanUp = await screen.findByRole("menuitem", { name: "Clean Up" });
    expect(cleanUp).toHaveAttribute("aria-disabled", "true");
    expect(cleanUp).toHaveAttribute("title", "Icons here always keep to the grid.");
    expect(screen.getByRole("menuitem", { name: "Clean Up By" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Show View Options" })).toBeInTheDocument();
  });
});

describe("the summary of several items", () => {
  it("shows the tags they share, and a change keeps each item's others", () => {
    expect(sharedTags([["Red", "Blue"], ["Blue"]])).toEqual(["Blue"]);
    expect(sharedTags([])).toEqual([]);
    expect(withSharedTags(["Red", "Blue"], ["Blue"], ["Green"])).toEqual(["Red", "Green"]);
  });

  it("keeps one comment on them all as it leaves the field", async () => {
    const onCommentChange = vi.fn();
    render(
      <FinderSummaryInfo
        root={root}
        paths={[`${HOME}/Documents/Budget.txt`, PICTURE]}
        onTagsChange={() => {}}
        onCommentChange={onCommentChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Comments:" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Comments" }), "For the trip");
    await userEvent.tab();
    expect(onCommentChange).toHaveBeenCalledExactlyOnceWith("For the trip");
  });
});

describe("Quick Look on the drive", () => {
  const seen = { url: "blob:x", type: "audio/mpeg" };

  it("plays a movie and a sound, and shows a PDF, from the file's own bytes", () => {
    const tree = {
      name: "Disk",
      kind: "volume" as const,
      children: [
        { name: "Clip.mp4", kind: "movie" as const },
        { name: "Song.mp3", kind: "audio" as const },
        { name: "Paper.pdf", kind: "pdf" as const },
      ],
    };
    const file = { url: "blob:bytes", type: "video/mp4" };
    const { container, rerender } = render(
      <FinderQuickLook root={tree} path="/Clip.mp4" file={file} />,
    );
    expect(container.querySelector("video")).toHaveAttribute("src", "blob:bytes");
    rerender(<FinderQuickLook root={tree} path="/Song.mp3" file={file} />);
    expect(container.querySelector("audio")).toHaveAttribute("src", "blob:bytes");
    rerender(<FinderQuickLook root={tree} path="/Paper.pdf" file={file} />);
    expect(screen.getByTitle("Paper.pdf")).toHaveAttribute("src", "blob:bytes");
  });

  it("dims Trim with its reason on a sound, and has no such button on a picture", () => {
    const tree = {
      name: "Disk",
      kind: "volume" as const,
      children: [
        { name: "Song.mp3", kind: "audio" as const },
        { name: "Sky.png", kind: "image" as const },
      ],
    };
    const { rerender } = render(<FinderQuickLook root={tree} path="/Song.mp3" file={seen} />);
    const trim = screen.getByRole("button", { name: "Trim" });
    expect(trim).toBeDisabled();
    expect(trim).toHaveAttribute(
      "title",
      "A browser plays this file but cannot write a shorter copy of it in its format.",
    );
    rerender(<FinderQuickLook root={tree} path="/Sky.png" file={seen} />);
    expect(screen.queryByRole("button", { name: "Trim" })).not.toBeInTheDocument();
  });

  it("hands Done the marks to save, and lets go of them once the file holds them", async () => {
    const user = userEvent.setup();
    const onSaveMarks = vi.fn(async () => true);
    render(<FinderQuickLook root={root} path={PICTURE} defaultMarkup onSaveMarks={onSaveMarks} />);
    await user.click(screen.getByRole("button", { name: "Text Style" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Large" }));
    await user.click(screen.getByRole("button", { name: "Text" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onSaveMarks).toHaveBeenCalledExactlyOnceWith(
      PICTURE,
      [{ id: 1, type: "text", offset: 0, text: "Text", color: "#000000", size: 28 }],
      0,
    );
    await vi.waitFor(() =>
      expect(screen.queryByRole("textbox", { name: /Text annotation/ })).not.toBeInTheDocument(),
    );
  });

  it("keeps the marks in the panel when the file could not take them", async () => {
    const user = userEvent.setup();
    render(
      <FinderQuickLook root={root} path={PICTURE} defaultMarkup onSaveMarks={async () => false} />,
    );
    await user.click(screen.getByRole("button", { name: "Text" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("textbox", { name: "Text annotation 1" })).toHaveValue("Text");
  });

  it("draws a crop by dragging, one at a time", async () => {
    const user = userEvent.setup();
    render(
      <FinderQuickLook root={root} path={PICTURE} defaultMarkup onSaveMarks={async () => true} />,
    );
    const picture = screen.getByRole("img", { name: /annotation/ });
    await user.click(screen.getByRole("button", { name: "Crop" }));
    await user.pointer([{ keys: "[MouseLeft]", target: picture }]);
    await user.pointer([{ keys: "[MouseLeft]", target: picture }]);
    expect(picture).toHaveAccessibleName("10-9.jpg, 1 annotation");
  });
});

describe("a picture pasted over an item's icon", () => {
  const tree = {
    name: "Disk",
    kind: "volume" as const,
    children: [
      { id: "note", name: "Note.txt", kind: "document" as const },
      { id: "shut", name: "Shut.txt", kind: "document" as const, locked: true },
    ],
  };
  const header = () => screen.getByRole("group", { name: /^Icon of / });

  it("hands the picture on, or says the clipboard holds none", () => {
    const onIconPaste = vi.fn();
    render(<FinderInfo root={tree} path="/Note.txt" onIconPaste={onIconPaste} />);
    const picture = new File(["x"], "p.png", { type: "image/png" });
    header().focus();
    fireEvent.paste(header(), { clipboardData: { files: [picture] } });
    expect(onIconPaste).toHaveBeenLastCalledWith("/Note.txt", picture);
    fireEvent.paste(header(), {
      clipboardData: { files: [new File(["x"], "p.txt", { type: "text/plain" })] },
    });
    expect(onIconPaste).toHaveBeenLastCalledWith("/Note.txt", undefined);
  });

  it("leaves a paste in the tags field to the field, and a locked item alone", () => {
    const onIconPaste = vi.fn();
    const { rerender } = render(
      <FinderInfo root={tree} path="/Note.txt" onIconPaste={onIconPaste} />,
    );
    const field = screen.getByLabelText("Tags");
    field.focus();
    fireEvent.paste(field, {
      clipboardData: { files: [] },
    });
    expect(onIconPaste).not.toHaveBeenCalled();
    rerender(<FinderInfo root={tree} path="/Shut.txt" onIconPaste={onIconPaste} />);
    expect(screen.queryByRole("group", { name: /^Icon of / })).not.toBeInTheDocument();
  });
});

describe("Sharing & Permissions on the drive", () => {
  it("shows the list and dims what would change it, with its reason", () => {
    render(<FinderInfo root={root} path={PICTURE} host={FINDER_INFO_HOST} />);
    expect(screen.getByRole("grid", { name: "Sharing & Permissions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a group" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add a group" })).toHaveAttribute(
      "title",
      FINDER_INFO_HOST.permissions,
    );
  });
});

describe("a Command drag", () => {
  it("moves as a plain drag does, and only Option copies: the drive is one volume", () => {
    const box = document.createElement("div");
    document.body.append(box);
    const copies: boolean[] = [];
    const stop = registerDropTarget({
      element: box,
      landing: (_hit, drag) => {
        copies.push(drag.copy);
        return { element: box, drop() {} };
      },
    });
    answerPoint(box);
    const go = (init: PointerEventInit) => {
      const item = { id: "a", name: "a", kind: "file" as const };
      beginDesktopDrag(new PointerEvent("pointerdown", { pointerId: 1 }), {
        from: "finder",
        items: () => [item],
      });
      window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 20, ...init }));
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientX: 20, ...init }));
    };
    go({ metaKey: true });
    expect(new Set(copies)).toEqual(new Set([false]));
    copies.length = 0;
    go({ altKey: true });
    expect(new Set(copies)).toEqual(new Set([true]));
    stop();
    box.remove();
  });
});

describe("the sidebar's Favorites", () => {
  afterEach(() => changeDesktopValue(FINDER_SIDEBAR_ORDER, []));

  it("lists rows in the person's order, and one added since after them", () => {
    const rows = [{ key: "a" }, { key: "b" }, { key: "c" }];
    expect(inSidebarOrder(rows, ["c", "gone", "a"]).map(({ key }) => key)).toEqual(["c", "a", "b"]);
    expect(inSidebarOrder(rows, []).map(({ key }) => key)).toEqual(["a", "b", "c"]);
  });

  it("takes a built-in row dragged onto another and keeps the order", async () => {
    serveDrive([]);
    render(<Finder />);
    const row = (name: string) => screen.findByRole("treeitem", { name });
    const documents = await row("Documents");
    const recents = await row("Recents");
    answerPoint(recents);
    fireEvent.pointerDown(documents, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    document.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 1, clientX: 0, clientY: 40, bubbles: true }),
    );
    document.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, clientX: 0, clientY: 40, bubbles: true }),
    );
    await vi.waitFor(() => {
      const names = screen.getAllByRole("treeitem").map((each) => each.textContent);
      expect(names.indexOf("Documents")).toBeLessThan(names.indexOf("Recents"));
    });
    const order = desktopValues()[FINDER_SIDEBAR_ORDER] as string[];
    expect(order[1]).toBe(`${HOME}/Documents`);
  });
});

describe("the Customize Toolbar sheet", () => {
  it("lets an item from its palette be dropped straight on the toolbar", async () => {
    render(<Finder />);
    const toolbar = screen.getByRole("toolbar", { name: "Finder toolbar" });
    fireEvent.contextMenu(toolbar);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Customize Toolbar…" }));
    await screen.findByRole("dialog", { name: "Customize Toolbar" });
    expect(toolbar.querySelector('[aria-label="New Folder"]')).toBeNull();
    fireEvent.drop(toolbar, {
      dataTransfer: {
        types: ["application/x-macalicious-toolbar-item"],
        getData: () => "new-folder",
      },
      clientX: 100_000,
    });
    await vi.waitFor(() => {
      const shown = [...toolbar.querySelectorAll("[data-toolbar-at]")];
      expect(shown.at(-1)?.querySelector('[aria-label="New Folder"]')).not.toBeNull();
    });
  });
});

describe("the other menu keys", () => {
  it("Command-R is the window's, not the browser's reload", async () => {
    const user = userEvent.setup();
    serveDrive([
      file("note", "Note.txt"),
      file("alias", "Note alias", { type: "application/x-macalicious-alias" }),
    ]);
    render(<Finder />);
    await user.click(await screen.findByRole("treeitem", { name: "Documents" }));
    const alias = await screen.findByRole("option", { name: "Note alias" });
    await user.click(alias);
    const unhandled = fireEvent.keyDown(alias, { key: "r", ctrlKey: true });
    expect(unhandled).toBe(false);
  });
});
