import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onDesktopEffects } from "../desktop/desktop-effects";
import { type DriveEntry, loadDrive } from "../desktop/desktop-files";
import {
  beginDesktopValues,
  changeDesktopValue,
  desktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { requestOpenFile } from "../finder/finder-open";
import { PreviewApp } from "./preview-app";
import type { PreviewDrive } from "./preview-drive";
import type { PdfFile } from "./preview-pdf";
import { keptFileOf, notePagesDragged, pagesDragged } from "./preview-windows";

/*
 * Preview's windows, one per file, in a real window manager hosted as the desktop hosts them. Stand-ins:
 * a `PreviewDrive` in memory, a listing for the shared Open dialog, a PDF reader in place of pdf.js and
 * a picture decoder. The real drive, pdf.js and the browser's drag are for
 * `e2e/preview-books-batch14-journey.mjs`.
 */

const entry = (id: string, name: string, type = "application/pdf"): DriveEntry => ({
  id,
  parent: "pictures",
  name,
  kind: "file",
  size: 5,
  type,
  created_ms: 1,
  modified_ms: 1,
});
const ONE = entry("one1", "one.pdf");
const TWO = entry("two1", "two.pdf");

function serve(files: DriveEntry[]) {
  const folders = ["Desktop", "Documents", "Downloads", "Movies", "Music", "Pictures"];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://desktop.test");
      if (url.pathname === "/api/files/") {
        return new Response(
          JSON.stringify({
            rev: 1,
            entries: [
              ...folders.map((name) => ({
                id: name.toLowerCase(),
                name,
                kind: "folder",
                size: 0,
                created_ms: 1,
                modified_ms: 1,
              })),
              ...files,
            ],
            usage: 0,
            quota: 1_000_000,
            piece_bytes: 4,
            max_file_bytes: 1000,
            max_entries: 100,
            session: "s",
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      if (url.pathname === "/api/preview/places") {
        return new Response(JSON.stringify({ places: [], rev: 1, session: "s" }), {
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }),
  );
}

const drive = (files: DriveEntry[]): PreviewDrive => ({
  read: async () => new Blob(["bytes"]),
  save: async () => files[0] as DriveEntry,
  replace: async (file) => file,
  current: async (id) => files.find((each) => each.id === id),
  opened: () => {},
  create: async () => files[0] as DriveEntry,
  duplicate: async (file) => file,
  rename: async (file) => file,
  move: async (file) => file,
  folders: async () => [],
});

const stubPdf = (): PdfFile => ({
  pageCount: 2,
  size: async () => ({ width: 612, height: 792 }),
  render: vi.fn(async () => true),
  text: async () => "",
  layOutText: async () => {},
  textRuns: async () => [],
  outline: async () => [],
  fields: async () => [],
  setField: () => {},
  filled: async () => new Uint8Array([7]),
  security: async () => ({}),
  links: async () => [],
  combined: async () => new Uint8Array([1, 2, 3]),
  destroy: vi.fn(),
});

interface Opened {
  id: string;
  opening?: unknown;
}

/** What the desktop does for Preview: a managed window per entry, and another for `newWindow`. */
function Desktop({
  files,
  first = [{ id: "preview" }],
}: {
  files: DriveEntry[];
  first?: Opened[];
}) {
  const [open, setOpen] = useState<Opened[]>(first);
  useEffect(
    () =>
      onDesktopEffects((effects) => {
        for (const effect of effects) {
          if (!("newWindow" in effect)) continue;
          setOpen((list) => [
            ...list,
            { id: `preview:${list.length + 1}`, opening: effect.opening },
          ]);
        }
      }),
    [],
  );
  return (
    <WindowManager style={{ height: 900, width: 1400 }}>
      {open.map(({ id, opening }) => (
        <ManagedWindow
          key={id}
          id={id}
          app="preview"
          title="Preview"
          defaultFrame={{ x: 10, y: 10, width: 800, height: 600 }}
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setOpen((list) => list.filter((each) => each.id !== id));
          }}
          render={(props) => (
            <DesktopWindowHostContext
              value={{ app: "preview", stage: () => null, place: () => ({}) }}
            >
              <PreviewApp
                {...props}
                {...(opening ? { opening: opening as never } : {})}
                drive={drive(files)}
                served
                loadPdf={async () => stubPdf()}
              />
            </DesktopWindowHostContext>
          )}
        />
      ))}
    </WindowManager>
  );
}

const windowOf = (id: string) =>
  document.querySelector<HTMLElement>(`[data-window-id="${id}"]`) as HTMLElement;
const titled = (id: string, name: string) =>
  waitFor(() => expect(within(windowOf(id)).getAllByText(name).length).toBeGreaterThan(0));

beforeEach(async () => {
  beginDesktopValues();
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  serve([ONE, TWO]);
  await loadDrive();
});

afterEach(() => {
  forgetDesktopValues();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function openFromDialog(name: string) {
  const dialog = await screen.findByRole("dialog", { name: "Open" });
  fireEvent.doubleClick(await within(dialog).findByRole("option", { name }));
}

describe("Preview's windows on the desktop", () => {
  it("opens a second file in a window of its own, and keeps which file each shows", async () => {
    render(<Desktop files={[ONE, TWO]} />);
    await openFromDialog("one.pdf");
    await titled("preview", "one.pdf");
    expect(keptFileOf("preview")).toBe("one1");

    fireEvent.keyDown(screen.getByRole("document", { name: "one.pdf" }), {
      key: "o",
      metaKey: true,
    });
    await openFromDialog("two.pdf");
    await titled("preview:2", "two.pdf");
    expect(within(windowOf("preview")).getAllByText("one.pdf").length).toBeGreaterThan(0);
    expect(keptFileOf("preview:2")).toBe("two1");
  });

  it("brings the window that has a file to the front rather than opening it twice", async () => {
    render(<Desktop files={[ONE, TWO]} />);
    await openFromDialog("one.pdf");
    await titled("preview", "one.pdf");
    requestOpenFile({ app: "preview", id: "two1", name: "two.pdf" });
    await titled("preview:2", "two.pdf");
    requestOpenFile({ app: "preview", id: "two1", name: "two.pdf" });
    requestOpenFile({ app: "preview", id: "one1", name: "one.pdf" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelectorAll("[data-window-id]")).toHaveLength(2);
  });

  it("brings a window back with the file it kept, and a closed window forgets it", async () => {
    changeDesktopValue("preview.windows", { preview: "one1", "preview:2": "two1" });
    const { rerender } = render(
      <Desktop files={[ONE, TWO]} first={[{ id: "preview" }, { id: "preview:2" }]} />,
    );
    await titled("preview", "one.pdf");
    await titled("preview:2", "two.pdf");

    fireEvent.click(within(windowOf("preview:2")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(windowOf("preview:2")).toBeNull());
    expect(desktopValues()["preview.windows"]).toEqual({ preview: "one1" });
    expect(within(windowOf("preview")).getAllByText("one.pdf").length).toBeGreaterThan(0);
    rerender(<Desktop files={[ONE, TWO]} />);
  });

  it("marks where pages from the other window will land, and takes them there", async () => {
    render(<Desktop files={[ONE, TWO]} />);
    await openFromDialog("one.pdf");
    await titled("preview", "one.pdf");
    requestOpenFile({ app: "preview", id: "two1", name: "two.pdf" });
    await titled("preview:2", "two.pdf");

    const list = (id: string) =>
      windowOf(id).querySelector(".mac-preview-app-thumbnails-frame") as HTMLElement;
    const row = await waitFor(() => {
      const found = list("preview:2").querySelector<HTMLElement>('[data-index="0"]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    const source = await waitFor(() => {
      const found = list("preview").querySelector<HTMLElement>('[data-index="1"]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    const dataTransfer = { setData: () => {}, files: [], effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(source, { dataTransfer });
    expect(pagesDragged()?.taken).toBe(false);
    fireEvent.dragOver(row, { dataTransfer, clientY: 0 });
    expect(list("preview:2").querySelector(".mac-preview-app-thumbnails-line")).not.toBeNull();
    fireEvent.drop(row, { dataTransfer, clientY: 0 });
    expect(pagesDragged()?.taken).toBe(true);
    expect(list("preview:2").querySelector(".mac-preview-app-thumbnails-line")).toBeNull();
    fireEvent.dragEnd(source, { dataTransfer });
    expect(pagesDragged()).toBeNull();
    notePagesDragged(null);
  });
});
