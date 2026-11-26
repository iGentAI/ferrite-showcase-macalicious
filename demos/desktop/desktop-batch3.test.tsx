import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { MenuItem } from "macalicious/menu-item";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriveOpenPanel } from "../finder/finder-file-dialogs";
import { CatalinaDesktop } from "./desktop";
import { useDesktopAppMenu } from "./desktop-app-menus";
import type { DesktopApp } from "./desktop-apps";
import { stackViewOf } from "./desktop-dock-places";
import { type DriveEntry, loadDrive } from "./desktop-files";
import { newestArrivalsFirst } from "./desktop-icon-places";
import { WINDOW_ZOOM_ROW } from "./desktop-menus";
import { answerHere, sendDraft } from "./desktop-siri-answers";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Siri's mail draft", () => {
  const CARDS = {
    cards: [
      {
        id: "c1",
        account: "mac",
        first: "Ada",
        last: "Lovelace",
        user: "ada",
        emails: [{ label: "work", value: "ada@example.org" }],
      },
    ],
  };

  it("holds the words said for the person to send, to the card's account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply(CARDS)),
    );
    const said = await answerHere("email ada about the ferry saying we leave at ten");
    expect(said?.text).toBe("Here’s your message to Ada Lovelace. Ready to send it?");
    expect(said?.draft).toMatchObject({
      to: "ada",
      name: "Ada Lovelace",
      subject: "The ferry",
      text: "we leave at ten",
    });
  });

  it("posts the draft under its own key, and a refusal keeps it with the server's words", async () => {
    const fetch = vi.fn(async () => reply({ id: "m1" }));
    vi.stubGlobal("fetch", fetch);
    const draft = { to: "ada", name: "Ada", subject: "Hi", text: "Hello", key: "k1" };
    expect((await sendDraft(draft)).text).toBe("Your message to Ada was sent.");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/mail/send");
    expect(JSON.parse(String(init.body))).toEqual({ to: ["ada"], subject: "Hi", text: "Hello" });
    expect(new Headers(init.headers).get("idempotency-key")).toBe("k1");

    fetch.mockImplementation(async () =>
      reply({ error: "this desktop sends mail only to its own accounts" }, 422),
    );
    const refused = await sendDraft(draft);
    expect(refused.text).toBe(
      "I couldn’t send it: this desktop sends mail only to its own accounts.",
    );
    expect(refused.draft).toEqual(draft);
  });
});

describe("the desktop's sort and stack rules", () => {
  it("puts the last to arrive first, and what has only just arrived before them", () => {
    expect(newestArrivalsFirst(["a", "b", "c", "d"], { a: 100, b: 300, c: 200 })).toEqual([
      "d",
      "b",
      "c",
      "a",
    ]);
  });

  it("shows a stack as Automatic asks: a fan of what fits at the bottom, else a grid", () => {
    expect(stackViewOf("automatic", 9, true)).toBe("fan");
    expect(stackViewOf("automatic", 10, true)).toBe("grid");
    expect(stackViewOf("automatic", 3, false)).toBe("grid");
    expect(stackViewOf("list", 3, true)).toBe("list");
  });
});

describe("the Open dialog's choices", () => {
  const entry = (id: string, name: string, kind: DriveEntry["kind"], parent?: string) =>
    ({ id, name, kind, parent, size: 0, created_ms: 1, modified_ms: 1 }) as DriveEntry;

  beforeEach(async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const drive = {
      rev: 1,
      session: `s-${Math.random()}`,
      entries: [
        entry("documents", "Documents", "folder"),
        entry("letters", "Letters", "folder", "documents"),
        entry("a", "One.txt", "file", "documents"),
        entry("b", "Two.txt", "file", "documents"),
        entry("c", "In letters.txt", "file", "letters"),
      ],
      usage: 0,
      quota: 1000,
      piece_bytes: 4,
      max_file_bytes: 100,
      max_entries: 100,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply(drive)),
    );
    await loadDrive();
  });

  it("hands over several files chosen with Command", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<DriveOpenPanel multiple onOpen={onOpen} onCancel={() => {}} />);
    await user.click(await screen.findByRole("option", { name: "One.txt" }));
    await user.keyboard("{Meta>}");
    await user.click(screen.getByRole("option", { name: "Two.txt" }));
    await user.keyboard("{/Meta}");
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpen.mock.calls[0]?.[0].map((each: DriveEntry) => each.name)).toEqual([
      "One.txt",
      "Two.txt",
    ]);
  });

  it("chooses the folder selected, or the one shown, and a double click still goes in", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<DriveOpenPanel chooseFolders onOpen={onOpen} onCancel={() => {}} />);
    await user.click(await screen.findByRole("option", { name: "Letters" }));
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Letters" }));
    await user.dblClick(screen.getByRole("option", { name: "Letters" }));
    expect(await screen.findByRole("option", { name: "In letters.txt" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() =>
      expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ id: "letters" })),
    );
  });
});

describe("the Window menu's rows of an application", () => {
  function Workbench({
    onClose: _onClose,
    onMinimize: _onMinimize,
    onZoom: _onZoom,
    zoomRole: _zoomRole,
    minimizeDisabled: _minimizeDisabled,
    zoomDisabled: _zoomDisabled,
    onDragRegionPointerDown: _down,
    onDragRegionDoubleClick: _double,
    ...windowProps
  }: ManagedWindowRenderProps) {
    useDesktopAppMenu("stickies", WINDOW_ZOOM_ROW, <MenuItem>Zoom to fit</MenuItem>);
    return (
      <Window {...windowProps}>
        <TitleBar title="Note" />
        <WindowBody />
      </Window>
    );
  }
  const app = (id: string, name: string): DesktopApp => ({
    id,
    name,
    component: Workbench,
    defaultSize: { width: 400, height: 300 },
    menus: [name, "File", "Window"],
  });

  it("takes an application's own Zoom in place of the desktop's", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={[app("stickies", "Stickies")]} defaultOpen={["stickies"]} />);
    await user.click(screen.getByRole("menuitem", { name: "Window" }));
    expect(await screen.findByRole("menuitem", { name: "Zoom to fit" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Zoom" })).toBeNull();
  });

  it("shows Music's window with its key, and no other application's", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <CatalinaDesktop apps={[app("music", "Music")]} defaultOpen={["music"]} />,
    );
    await user.click(screen.getByRole("menuitem", { name: "Window" }));
    const row = await screen.findByRole("menuitemcheckbox", { name: /^Music/ });
    expect(row.textContent).toContain("⌥⌘1");
    unmount();
    render(<CatalinaDesktop apps={[app("tv", "TV")]} defaultOpen={["tv"]} />);
    await user.click(screen.getByRole("menuitem", { name: "Window" }));
    const other = await screen.findByRole("menuitemcheckbox", { name: /^TV/ });
    expect(other.textContent).not.toContain("1");
  });
});
