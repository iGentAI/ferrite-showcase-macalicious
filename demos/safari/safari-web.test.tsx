import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { landingAt } from "../desktop/desktop-drag";
import { DESKTOP_EFFECTS_EVENT, type DesktopEffect } from "../desktop/desktop-effects";
import { type DriveEntry, DriveError } from "../desktop/desktop-files";
import { openUrl, takeOpenUrlRequests } from "../desktop/desktop-open-url";
import { changeDesktopValue } from "../desktop/desktop-personal";
import { reloadServerDocuments, serverDocument } from "../desktop/desktop-server";
import { SHARE_RECEIVERS } from "../desktop/desktop-share-link";
import { openFile, takeOpenFileRequests } from "../finder/finder-open";
import { Safari } from "./safari";
import { SafariPreferences } from "./safari-preferences";
import {
  AUTO_READER,
  ENGINE_SUGGESTIONS,
  FULL_ADDRESS,
  MAKE_ACTIVE,
  SAFARI_SETTINGS,
  TAB_KEYS,
} from "./safari-settings";
import {
  adoptKeptTabs,
  failureText,
  frequentlyVisited,
  keptAddress,
  moveTab,
  outsideRefusal,
  privateHost,
  SEARCH,
  webAddressFor,
} from "./safari-web";

/*
 * Safari as the Ferrite desktop app serves it (`VITE_MACALICIOUS_API=1`). The server is a test
 * double here: `fetch` answers /api/safari/ from a small table, so these tests hold the window's
 * side (frames, messages, Back and Forward, error pages, what it saves). The module itself is
 * tested in ferrite-apps/desktop (cargo test), and real pages by e2e/safari-journey.mjs.
 */

const field = () => screen.getByRole("textbox", { name: "Search or enter website name" });
const button = (name: string) => screen.getByRole("button", { name });

/** The person's drive, as far as a download needs it: what was uploaded, and a failure to give. */
const drive = vi.hoisted(() => ({
  uploads: [] as { parent: string; name: string; existing: string; size: number; type: string }[],
  fail: null as Error | null,
}));
vi.mock("../desktop/desktop-files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../desktop/desktop-files")>();
  return {
    ...actual,
    ensureDrive: vi.fn(async () => ({ entries: [] })),
    readFile: vi.fn(async () => new Blob(["<p>From the drive</p>"], { type: "text/html" })),
    useDrive: vi.fn(() => ({
      rev: 1,
      entries: [
        ...["documents", "downloads"].map((id) => ({
          id,
          name: id,
          kind: "folder" as const,
          size: 0,
          created_ms: 0,
          modified_ms: 0,
        })),
        {
          id: "page-3",
          parent: "downloads",
          name: "saved page.html",
          kind: "file" as const,
          size: 10,
          created_ms: 0,
          modified_ms: 0,
        },
      ],
      usage: 0,
      quota: 1_000_000,
      piece_bytes: 1_000,
      max_file_bytes: 1_000_000,
      max_entries: 1_000,
    })),
    uploadFile: vi.fn(
      async (blob: Blob, parent: string, options: { name: string; existing: string }) => {
        if (drive.fail) throw drive.fail;
        drive.uploads.push({
          parent,
          name: options.name,
          existing: options.existing,
          size: blob.size,
          type: blob.type,
        });
        return {
          id: `file-${drive.uploads.length}`,
          parent,
          name: options.name,
          kind: "file",
          size: blob.size,
          created_ms: 0,
          modified_ms: 0,
        } satisfies DriveEntry;
      },
    ),
  };
});

async function go(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(field());
  await user.clear(field());
  await user.type(field(), `${text}{Enter}`);
}

const CATALINA = "https://en.wikipedia.org/wiki/MacOS_Catalina";
const MOJAVE = "https://en.wikipedia.org/wiki/MacOS_Mojave";

type Reply = Record<string, unknown>;

const fetched = (title: string): Reply => ({
  ok: true,
  title,
  html: `<!DOCTYPE html><title>${title}</title><p>${title}</p>`,
  status: 200,
  bytes: 100,
  reader: [
    { kind: "h", text: title },
    { kind: "p", text: "First paragraph of the article, long enough to read." },
    { kind: "p", text: "Second paragraph of the article, long enough to read." },
    { kind: "p", text: "Third paragraph of the article, long enough to read." },
  ],
});

/** A stand-in for the module: pages by address, the documents it keeps, what was asked. */
function fakeServer(pages: Record<string, Reply>, files: Record<string, Reply> = {}) {
  const asked: string[] = [];
  const saves: { url: string; body: Reply }[] = [];
  const documentReads: string[] = [];
  const extras = {
    filePage: { ok: true, title: "My notes", html: "<p>My notes</p>", reader: null } as Reply,
    fileBodies: [] as Reply[],
    suggestions: [] as string[],
    suggested: [] as string[],
  };
  const docs = new Map<string, Reply>();
  const history = [
    { url: CATALINA, title: "macOS Catalina - Wikipedia", at: Date.now(), count: 3 },
    { url: "https://text.npr.org/", title: "NPR", at: Date.now() - 1000, count: 1 },
  ];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://desktop.test");
    const method = init?.method ?? "GET";
    const path = url.pathname;
    if (path === "/api/safari/sites") {
      return json({
        sites: [
          {
            host: "en.wikipedia.org",
            title: "Wikipedia",
            url: "https://en.wikipedia.org/wiki/Main_Page",
          },
          { host: "text.npr.org", title: "NPR", url: "https://text.npr.org/" },
        ],
        search: SEARCH,
      });
    }
    if (path === "/api/safari/page") {
      const address = url.searchParams.get("url") ?? "";
      asked.push(address);
      // `_history` is the reply's x-safari-history header: whether the server kept the visit.
      const { _history, ...reply } = pages[address] ?? {
        ok: false,
        kind: "not-listed",
        host: null,
        message: "",
      };
      const response = json({ url: address, ...reply });
      if (typeof _history === "string") response.headers.set("x-safari-history", _history);
      return response;
    }
    if (path === "/api/safari/file") {
      const address = url.searchParams.get("url") ?? "";
      const reply = files[address] ?? { ok: false, kind: "not-listed", host: null, message: "" };
      return json({ url: address, ...reply });
    }
    if (path === "/api/safari/file-page") {
      extras.fileBodies.push(JSON.parse(String(init?.body)) as Reply);
      return json(extras.filePage);
    }
    if (path === "/api/safari/suggest") {
      extras.suggested.push(url.searchParams.get("q") ?? "");
      return json({ suggestions: extras.suggestions });
    }
    if (path === "/api/safari/history") {
      if (method === "DELETE") {
        history.length = 0;
        return json({ history: null, rev: 1 });
      }
      if (method === "POST") {
        saves.push({ url: path, body: JSON.parse(String(init?.body)) as Reply });
        return json({ ok: true });
      }
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const found = history.filter((visit) =>
        `${visit.title} ${visit.url}`.toLowerCase().includes(q),
      );
      return json({ history: history.length ? found : null, rev: 1, session: "s1" });
    }
    if (method === "PUT") {
      const body = JSON.parse(String(init?.body)) as Reply;
      saves.push({ url: path, body });
      const rev = Number(body.rev) + 1;
      docs.set(path, { ...body, rev });
      return json({ ...body, rev });
    }
    if (method === "GET") documentReads.push(path);
    return json(docs.get(path) ?? { rev: 0, session: "s1" });
  });
  vi.stubGlobal("fetch", fetchStub);
  return { asked, saves, docs, documentReads, extras };
}

beforeEach(() => {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
});

afterEach(() => {
  changeDesktopValue(SAFARI_SETTINGS, undefined);
  changeDesktopValue("safari.sidebarShown", undefined);
  changeDesktopValue("safari.favoritesBarShown", undefined);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  takeOpenUrlRequests();
  takeOpenFileRequests("finder");
  drive.uploads.length = 0;
  drive.fail = null;
});

describe("the address field on the web", () => {
  it("reads an address with or without its scheme, and anything else as a search", () => {
    expect(webAddressFor("en.wikipedia.org/wiki/Cat")).toBe("https://en.wikipedia.org/wiki/Cat");
    expect(webAddressFor("http://example.com")).toBe("http://example.com/");
    expect(webAddressFor("localhost:8787")).toBe("https://localhost:8787/");
    expect(webAddressFor("ftp://example.com/")).toBe("ftp://example.com/");
    expect(webAddressFor("javascript:alert(1)")).toBe("javascript:alert(1)");
    expect(webAddressFor("macOS Catalina")).toBe(`${SEARCH}macOS+Catalina`);
    expect(webAddressFor("catalina")).toBe(`${SEARCH}catalina`);
    expect(webAddressFor("  ")).toBe("");
    // Normalised as the browser's URL parser writes an address: the host in lower case, an
    // international name in its ASCII form, unsafe characters encoded, a path of at least "/".
    expect(webAddressFor("  EN.Wikipedia.ORG/wiki/Dog ")).toBe("https://en.wikipedia.org/wiki/Dog");
    expect(webAddressFor("münchen.de")).toBe("https://xn--mnchen-3ya.de/");
    expect(webAddressFor("https://bücher.de/a b")).toBe("https://xn--bcher-kva.de/a%20b");
    // Text the parser refuses goes to the server as typed, which refuses it with a reason.
    expect(webAddressFor("http://exa mple.com")).toBe("http://exa mple.com");
    expect(webAddressFor("https://")).toBe("https://");
    // A number with a dot is a search, as in other browsers; four dotted numbers an address.
    expect(webAddressFor("1.5")).toBe(`${SEARCH}1.5`);
    expect(webAddressFor("3.14159")).toBe(`${SEARCH}3.14159`);
    expect(webAddressFor("1.2.3.4")).toBe("https://1.2.3.4/");
  });

  it("offers in a browser tab only public pages of another site than the desktop's", () => {
    const own = "https://macalicious.ferrite.run";
    expect(outsideRefusal("https://www.example.org/a", own)).toBeNull();
    expect(outsideRefusal("http://www.example.org/a", own)).toBeNull();
    expect(outsideRefusal("https://macalicious.ferrite.run/index.html", own)?.kind).toBe("own");
    expect(outsideRefusal("http://macalicious.ferrite.run/", own)?.kind).toBe("own");
    expect(outsideRefusal("ftp://example.org/", own)?.kind).toBe("scheme");
    expect(outsideRefusal("javascript:alert(1)", own)?.kind).toBe("scheme");
    expect(outsideRefusal("https://user:pw@example.org/", own)?.kind).toBe("credentials");
    for (const host of [
      "localhost",
      "127.0.0.1",
      "10.1.2.3",
      "192.168.1.1",
      "169.254.169.254",
      "[::1]",
      "[fd00::1]",
      "[::ffff:7f00:1]",
      "router.local",
      "metadata.google.internal",
      "intranet",
    ]) {
      expect(outsideRefusal(`https://${host}/`, own)?.kind, host).toBe("private");
    }
    // The URL parser writes odd IPv4 spellings in their dotted form first.
    expect(outsideRefusal("http://2130706433/", own)?.kind).toBe("private");
    expect(outsideRefusal("http://0x7f.1/", own)?.kind).toBe("private");
    expect(privateHost("8.8.8.8")).toBe(false);
  });

  it("keeps only web addresses as tabs, and counts pages visited more than once as frequent", () => {
    expect(keptAddress("https://example.org/")).toBe("https://example.org/");
    expect(keptAddress("safari:history")).toBe("");
    expect(keptAddress("ftp://x/")).toBe("");
    // A host some engines' parsers escape instead of refusing is never kept (the server would
    // refuse the whole tabs document).
    expect(keptAddress("http://exa%20mple.com/")).toBe("");
    expect(keptAddress("https://xn--mnchen-3ya.de/")).toBe("https://xn--mnchen-3ya.de/");
    expect(keptAddress("http://[2606:4700::1111]/")).toBe("http://[2606:4700::1111]/");
    // A fully qualified name ending in the root's dot is kept and opened by the server too.
    expect(keptAddress("https://example.org./")).toBe("https://example.org./");
    expect(webAddressFor("example.org.")).toBe("https://example.org./");
    expect(keptAddress("https://example..org/")).toBe("");
    // An address with a user name or password is never kept: the server refuses it, and with it
    // the whole tabs document, so the window's tabs would stop being kept (HTTP 400 on each save).
    expect(keptAddress("https://user:secret@en.wikipedia.org/")).toBe("");
    expect(keptAddress("https://user@example.org/")).toBe("");
    expect(keptAddress("https://example.org/a@b")).toBe("https://example.org/a@b");
    const visit = (url: string, count: number, at: number) => ({ url, title: url, count, at });
    expect(
      frequentlyVisited([visit("a", 1, 3), visit("b", 4, 1), visit("c", 2, 2)]).map((v) => v.url),
    ).toEqual(["b", "c"]);
  });

  it("words each failure as Safari does", () => {
    const page = (kind: string) =>
      failureText({ kind, host: "example.org", url: "https://example.org/", message: "" });
    expect(page("not-found").title).toBe("Safari Can’t Find the Server");
    expect(page("timeout").body).toContain("isn’t responding");
    expect(page("too-large").body).toContain("larger than the 1 MB");
    expect(
      failureText({ kind: "scheme", host: null, url: "ftp://x/", message: "" }).body,
    ).toContain("starting with “ftp:”");
  });

  it("adopts kept tabs by keeping every tab that already shows its place's address", () => {
    const tab = (id: string, history: string[], index = history.length - 1) => ({
      id,
      history,
      index,
    });
    let made = 0;
    const fresh = (address: string) => tab(`new-${made++}`, [address]);
    const a = tab("a", ["", CATALINA, MOJAVE]);
    const b = tab("b", ["safari:history"]);
    expect(adoptKeptTabs([a, b], "a", [MOJAVE, ""], 0, fresh)).toBeNull();
    expect(adoptKeptTabs([a, b], "a", [MOJAVE, ""], 1, fresh)).toEqual({
      tabs: [a, b],
      activeId: "b",
    });
    const adopted = adoptKeptTabs([a, b], "a", [MOJAVE, CATALINA, ""], 2, fresh);
    expect(adopted?.tabs[0]).toBe(a);
    expect(adopted?.tabs.map((t) => t.id)).toEqual(["a", "new-0", "new-1"]);
    expect(adopted?.tabs[1]?.history).toEqual([CATALINA]);
    expect(adopted?.activeId).toBe("new-1");
    const fewer = adoptKeptTabs([a, b], "b", [CATALINA], 5, fresh);
    expect(fewer?.tabs.map((t) => t.history)).toEqual([[CATALINA]]);
    expect(fewer?.activeId).toBe(fewer?.tabs[0]?.id);
    for (const front of [0.5, Number.NaN, Number.POSITIVE_INFINITY, -2]) {
      expect(adoptKeptTabs([a, b], "b", [MOJAVE, ""], front, fresh)?.activeId, String(front)).toBe(
        "a",
      );
    }
    expect(adoptKeptTabs([a], "a", [], 0, fresh)).toBeNull();
  });

  it("moves a dragged tab to the place it is dropped at among the others", () => {
    const order = (list: readonly { id: string }[]) => list.map((tab) => tab.id).join("");
    const three = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(order(moveTab(three, "c", 0))).toBe("cab");
    expect(order(moveTab(three, "a", 2))).toBe("bca");
    expect(order(moveTab(three, "a", 9))).toBe("bca");
    expect(order(moveTab(three, "b", -3))).toBe("bac");
    expect(moveTab(three, "b", 1)).toBe(three);
    expect(moveTab(three, "z", 0)).toBe(three);
  });
});

describe("Safari on the Ferrite desktop app", () => {
  it("opens a listed page in a sandboxed frame, follows its links and walks Back and Forward", async () => {
    const user = userEvent.setup();
    const server = fakeServer({
      [CATALINA]: fetched("macOS Catalina - Wikipedia"),
      [MOJAVE]: fetched("macOS Mojave - Wikipedia"),
    });
    render(<Safari />);
    // The start page's Favorites are the listed sites, until the person changes them.
    expect(await screen.findByRole("link", { name: "Wikipedia" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Favorites bar" })).getByText("NPR"),
    ).toBeVisible();

    await go(user, "en.wikipedia.org/wiki/MacOS_Catalina");
    const catalina = await screen.findByTitle("macOS Catalina - Wikipedia");
    expect(catalina.tagName).toBe("IFRAME");
    expect(catalina).toHaveAttribute("sandbox", "allow-scripts allow-forms allow-modals");
    expect(catalina.getAttribute("srcdoc")).toContain("<p>macOS Catalina - Wikipedia</p>");
    expect(field()).toHaveValue(CATALINA);

    // A message from anything but the page in front is ignored.
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { safari: 1, type: "navigate", url: "https://evil.example.org/" },
          source: window,
        }),
      );
    });
    expect(field()).toHaveValue(CATALINA);
    // A link clicked in the page arrives as a message from its frame.
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { safari: 1, type: "navigate", url: MOJAVE },
          source: (catalina as HTMLIFrameElement).contentWindow,
        }),
      );
    });
    expect(await screen.findByTitle("macOS Mojave - Wikipedia")).toBeInTheDocument();
    expect(field()).toHaveValue(MOJAVE);

    await user.click(button("Back"));
    expect(await screen.findByTitle("macOS Catalina - Wikipedia")).toBeInTheDocument();
    expect(field()).toHaveValue(CATALINA);
    await user.click(button("Forward"));
    expect(await screen.findByTitle("macOS Mojave - Wikipedia")).toBeInTheDocument();
    expect(server.asked).toEqual([CATALINA, MOJAVE]);

    await user.click(button("Reload this page"));
    await waitFor(() => expect(server.asked).toEqual([CATALINA, MOJAVE, MOJAVE]));
    expect(await screen.findByTitle("macOS Mojave - Wikipedia")).toBeInTheDocument();

    // The article in Reader.
    await user.click(button("Show Reader View"));
    expect(
      screen.getByRole("heading", { level: 1, name: "macOS Mojave - Wikipedia" }),
    ).toBeVisible();
    expect(screen.getByText("Third paragraph of the article, long enough to read.")).toBeVisible();
  });

  it("says a page off the list opens outside Safari, frames nothing, and offers a browser tab", async () => {
    const user = userEvent.setup();
    const server = fakeServer({});
    const open = vi.fn();
    vi.stubGlobal("open", open);
    render(<Safari />);
    await go(user, "www.example.org/news");
    expect(
      await screen.findByRole("heading", { name: "This Page Opens Outside Safari" }),
    ).toBeVisible();
    expect(screen.getByText(/open “example\.org” in a new tab/)).toBeVisible();
    // The reason Safari can give: it cannot tell, and it never says this site refused.
    expect(
      screen.getByText(/can’t tell whether another site allows being shown inside/),
    ).toBeVisible();
    expect(screen.queryByText(/refused/)).toBeNull();
    expect(screen.queryByText(/could not check this address/)).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
    expect(field()).toHaveValue("https://www.example.org/news");
    await user.click(button("Open in New Browser Tab"));
    expect(open).toHaveBeenCalledWith(
      "https://www.example.org/news",
      "_blank",
      "noopener,noreferrer",
    );
    // The page opened in a browser tab is added to the history.
    await waitFor(() =>
      expect(server.saves).toContainEqual({
        url: "/api/safari/history",
        body: { url: "https://www.example.org/news", title: "" },
      }),
    );
  });

  it("keeps a visit in the history that the server had no time to keep, and only then", async () => {
    const user = userEvent.setup();
    const server = fakeServer({
      [CATALINA]: { ...fetched("macOS Catalina - Wikipedia"), _history: "skipped" },
      [MOJAVE]: { ...fetched("macOS Mojave - Wikipedia"), _history: "kept" },
    });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    await waitFor(() =>
      expect(server.saves).toContainEqual({
        url: "/api/safari/history",
        body: { url: CATALINA, title: "macOS Catalina - Wikipedia" },
      }),
    );
    await go(user, MOJAVE);
    await screen.findByTitle("macOS Mojave - Wikipedia");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    // The server kept Mojave's visit itself: the window does not add it a second time.
    expect(
      server.saves
        .filter((save) => save.url === "/api/safari/history")
        .map((save) => save.body.url),
    ).toEqual([CATALINA]);
  });

  it("says when it could not check an unlisted address before offering it", async () => {
    const user = userEvent.setup();
    fakeServer({
      "https://www.example.net/x": {
        ok: false,
        kind: "not-listed",
        host: "www.example.net",
        checked: false,
      },
    });
    render(<Safari />);
    await go(user, "www.example.net/x");
    expect(await screen.findByText(/could not check this address first/)).toBeVisible();
    expect(button("Open in New Browser Tab")).toBeEnabled();
  });

  it("downloads a listed site's file into the Downloads folder, and shows it in Finder", async () => {
    const user = userEvent.setup();
    const FILE = "https://www.gnu.org/graphics/head.png";
    const BIG = "https://www.gutenberg.org/cache/epub/1342/big.epub";
    fakeServer(
      {
        [FILE]: { ok: false, kind: "unsupported", host: "www.gnu.org" },
        [BIG]: { ok: false, kind: "unsupported", host: "www.gutenberg.org" },
      },
      {
        // "\x89PNG" in base64.
        [FILE]: { ok: true, name: "head.png", type: "image/png", size: 4, data: "iVBORw==" },
        [BIG]: { ok: false, kind: "too-large", host: "www.gutenberg.org" },
      },
    );
    const effects: DesktopEffect[] = [];
    const hear = (event: Event) => effects.push(...(event as CustomEvent<DesktopEffect[]>).detail);
    window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
    try {
      render(<Safari />);
      await go(user, FILE);
      expect(await screen.findByText(/it is not a web page/)).toBeVisible();
      await user.click(button("Download to Downloads Folder"));
      expect(await screen.findByText("“head.png” is in your Downloads folder.")).toBeVisible();
      expect(drive.uploads).toEqual([
        { parent: "downloads", name: "head.png", existing: "rename", size: 4, type: "image/png" },
      ]);
      await user.click(button("Show in Finder"));
      expect(takeOpenFileRequests("finder")).toEqual([
        { app: "finder", id: "file-1", name: "head.png" },
      ]);
      expect(effects).toContainEqual({ open: "finder" });

      // Over the platform's cap: refused with the reason, and nothing is saved.
      await go(user, BIG);
      await user.click(await screen.findByRole("button", { name: "Download to Downloads Folder" }));
      expect(await screen.findByText(/larger than the 1 MB/)).toBeVisible();
      expect(button("Try Again")).toBeEnabled();
      expect(drive.uploads).toHaveLength(1);

      // A full drive: the drive's own sentence, and nothing claims the file was saved.
      drive.fail = new DriveError(507, "There is not enough space on your drive.");
      await go(user, FILE);
      await user.click(await screen.findByRole("button", { name: "Download to Downloads Folder" }));
      expect(await screen.findByText("There is not enough space on your drive.")).toBeVisible();
      expect(screen.queryByText(/is in your Downloads folder/)).toBeNull();
    } finally {
      window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear);
    }
  });

  it("keeps the page, Back and Forward when Safari's documents are reloaded in the background", async () => {
    // On the hosted desktop the live stream reloads an app's documents after changes it cannot
    // tell are this browser's own (two quick saves of the tabs are enough). The tabs read back
    // are the window's own: its page must stay mounted and its history must stay.
    const user = userEvent.setup();
    const server = fakeServer({
      [CATALINA]: fetched("macOS Catalina - Wikipedia"),
      [MOJAVE]: fetched("macOS Mojave - Wikipedia"),
    });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    const catalina = await screen.findByTitle("macOS Catalina - Wikipedia");
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { safari: 1, type: "navigate", url: MOJAVE },
          source: (catalina as HTMLIFrameElement).contentWindow,
        }),
      );
    });
    const mojave = await screen.findByTitle("macOS Mojave - Wikipedia");
    await waitFor(() => {
      const saved = server.saves.filter((save) => save.url === "/api/safari/tabs").at(-1);
      expect(saved?.body.tabs).toEqual([MOJAVE]);
    });
    const tabReads = () =>
      server.documentReads.filter((path) => path === "/api/safari/tabs").length;
    /** Reload Safari's documents in the background and wait until the window has been given the
     * tabs read. */
    const reloadInBackground = async () => {
      const before = tabReads();
      await act(async () => {
        reloadServerDocuments("safari");
        await serverDocument("/api/safari/tabs").idle();
      });
      expect(tabReads()).toBe(before + 1);
    };
    await reloadInBackground();
    expect(screen.getByTitle("macOS Mojave - Wikipedia")).toBe(mojave);
    expect(mojave.isConnected).toBe(true);
    expect(field()).toHaveValue(MOJAVE);
    server.docs.set("/api/safari/tabs", {
      tabs: [CATALINA, "https://text.npr.org/"],
      active: 1,
      rev: 99,
      session: "s1",
    });
    await reloadInBackground();
    expect(screen.getByTitle("macOS Mojave - Wikipedia")).toBe(mojave);
    expect(field()).toHaveValue(MOJAVE);
    expect(screen.queryByRole("tab")).toBeNull();
    expect(button("Back")).toBeEnabled();
    await user.click(button("Back"));
    expect(await screen.findByTitle("macOS Catalina - Wikipedia")).toBeInTheDocument();
    expect(field()).toHaveValue(CATALINA);
    expect(server.asked).toEqual([CATALINA, MOJAVE]);
  });

  it("shows Safari's error pages for what cannot be opened", async () => {
    const user = userEvent.setup();
    fakeServer({
      "http://169.254.169.254/latest/meta-data/": {
        ok: false,
        kind: "private",
        host: "169.254.169.254",
      },
      "https://en.wikipedia.org/wiki/United_States": {
        ok: false,
        kind: "too-large",
        host: "en.wikipedia.org",
      },
      "https://nope.invalid.example.org/": {
        ok: false,
        kind: "not-found",
        host: "nope.invalid.example.org",
      },
      "ftp://example.org/": { ok: false, kind: "scheme", host: null },
    });
    render(<Safari />);
    await go(user, "http://169.254.169.254/latest/meta-data/");
    expect(await screen.findByText(/is on a private or local network/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Safari Can’t Open the Page" })).toBeVisible();
    await go(user, "en.wikipedia.org/wiki/United_States");
    expect(await screen.findByText(/larger than the 1 MB/)).toBeVisible();
    await go(user, "nope.invalid.example.org");
    expect(
      await screen.findByRole("heading", { name: "Safari Can’t Find the Server" }),
    ).toBeVisible();
    await go(user, "ftp://example.org/");
    expect(await screen.findByText(/starting with “ftp:”/)).toBeVisible();
    // A local address is never offered, whatever the server says.
    await go(user, "http://localhost:3000/");
    expect(await screen.findByText(/is on a private or local network/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Open in New Browser Tab" })).toBeNull();
  });

  it("keeps Favorites, the Reading List and the open tabs on the server", async () => {
    const user = userEvent.setup();
    const server = fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");

    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Add Bookmark" }));
    await user.click(await screen.findByRole("button", { name: "Add" }));
    await waitFor(() => {
      const saved = server.saves.filter((save) => save.url === "/api/safari/bookmarks").at(-1);
      expect(saved?.body.favorites).toContainEqual({
        title: "macOS Catalina - Wikipedia",
        url: CATALINA,
      });
    });
    expect(
      within(screen.getByRole("navigation", { name: "Favorites bar" })).getByText(
        "macOS Catalina - Wikipedia",
      ),
    ).toBeVisible();

    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Add to Reading List" }));
    await waitFor(() => {
      const saved = server.saves.filter((save) => save.url === "/api/safari/reading-list").at(-1);
      expect(saved?.body.items).toEqual([
        expect.objectContaining({
          title: "macOS Catalina - Wikipedia",
          url: CATALINA,
          read: false,
        }),
      ]);
    });
    await waitFor(() => {
      const saved = server.saves.filter((save) => save.url === "/api/safari/tabs").at(-1);
      expect(saved?.body).toEqual(expect.objectContaining({ tabs: [CATALINA], active: 0 }));
    });
  });

  it("copies the page's link from the Share menu, and dims each service that cannot take it", async () => {
    const user = userEvent.setup();
    fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Copy Link" }));
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(CATALINA));
    await user.click(button("Share"));
    const mail = await screen.findByRole("menuitem", { name: "Email This Page" });
    // Enabled once Mail takes shared links (SHARE_RECEIVERS), otherwise dimmed with the reason.
    if (SHARE_RECEIVERS.has("mail")) {
      expect(mail).not.toHaveAttribute("aria-disabled", "true");
    } else {
      expect(mail).toHaveAttribute("aria-disabled", "true");
      expect(mail.getAttribute("title")).toBe("Mail can’t take a shared link yet.");
    }
    expect(screen.getByRole("menuitem", { name: "AirDrop" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // More… opens the Extensions preferences, and a browser's Safari has no extensions: dimmed, saying so.
    const more = screen.getByRole("menuitem", { name: /^More/ });
    expect(more).toHaveAttribute("aria-disabled", "true");
    expect(more.getAttribute("title")).toBe(
      "More… opens the Extensions preferences, and Safari in a browser runs no extensions.",
    );
  });

  it("opens the tabs kept from last time, and the History page searches the history", async () => {
    const user = userEvent.setup();
    const server = fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    server.docs.set("/api/safari/tabs", { tabs: ["", CATALINA], active: 1, rev: 3, session: "s1" });
    render(<Safari />);
    expect(await screen.findByTitle("macOS Catalina - Wikipedia")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);

    await user.click(screen.getByRole("tab", { name: "Favorites" }));
    // Catalina was visited three times: it is Frequently Visited.
    expect(await screen.findByRole("heading", { name: "Frequently Visited" })).toBeVisible();
    await user.click(button("Show All History"));
    const history = await screen.findByRole("region", { name: "History" });
    expect(await within(history).findByText("NPR")).toBeVisible();
    await user.type(within(history).getByRole("searchbox", { name: "Search History" }), "catalina");
    await waitFor(() => expect(within(history).queryByText("NPR")).not.toBeInTheDocument());
    expect(within(history).getByText("macOS Catalina - Wikipedia")).toBeVisible();
    await user.click(within(history).getByRole("button", { name: "Clear History…" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Clear History" }),
    );
    expect(await within(history).findByText("No Results")).toBeVisible();
  });

  it("keeps a tab opened while the kept tabs are being read, after them", async () => {
    const server = fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    server.docs.set("/api/safari/tabs", { tabs: [CATALINA], active: 0, rev: 3, session: "s1" });
    const answered = globalThis.fetch;
    let release: (() => void) | undefined;
    let held = false;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (!held && String(url).includes("/api/safari/tabs") && (init?.method ?? "GET") === "GET") {
        held = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return answered(url, init);
    });
    render(<Safari />);
    await waitFor(() => expect(release).toBeDefined());
    fireEvent.keyDown(screen.getByRole("region", { name: "Safari" }), { key: "t", ctrlKey: true });
    expect(await screen.findAllByRole("tab")).toHaveLength(2);
    await act(async () => {
      release?.();
      await serverDocument("/api/safari/tabs").idle();
    });
    await waitFor(() => {
      const saved = server.saves.filter((save) => save.url === "/api/safari/tabs").at(-1);
      expect(saved?.body.tabs).toEqual([CATALINA, ""]);
    });
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Favorites");
  });

  it("keeps an address gone to while the kept tabs are being read, and the kept tabs before it", async () => {
    const user = userEvent.setup();
    const server = fakeServer({
      [CATALINA]: fetched("macOS Catalina - Wikipedia"),
      [MOJAVE]: fetched("macOS Mojave - Wikipedia"),
    });
    server.docs.set("/api/safari/tabs", { tabs: [CATALINA], active: 0, rev: 3, session: "s1" });
    const answered = globalThis.fetch;
    let release: (() => void) | undefined;
    let held = false;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (!held && String(url).includes("/api/safari/tabs") && (init?.method ?? "GET") === "GET") {
        held = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return answered(url, init);
    });
    render(<Safari />);
    await waitFor(() => expect(release).toBeDefined());
    await go(user, MOJAVE);
    const mojave = await screen.findByTitle("macOS Mojave - Wikipedia");
    await act(async () => {
      release?.();
      await serverDocument("/api/safari/tabs").idle();
    });
    await waitFor(() => {
      const saved = server.saves.filter((save) => save.url === "/api/safari/tabs").at(-1);
      expect(saved?.body.tabs).toEqual([CATALINA, MOJAVE]);
    });
    expect(screen.getByTitle("macOS Mojave - Wikipedia")).toBe(mojave);
    expect(field()).toHaveValue(MOJAVE);
  });

  it("opens an address another app sends in a new tab, and says it did", async () => {
    fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    let unhandled = true;
    act(() => {
      unhandled = window.dispatchEvent(
        new CustomEvent("macalicious:open-url", { detail: { url: CATALINA }, cancelable: true }),
      );
    });
    expect(unhandled).toBe(false);
    expect(await screen.findByTitle("macOS Catalina - Wikipedia")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("opens a link another app asked for before Safari opened, after the tabs it kept", async () => {
    const server = fakeServer({
      [CATALINA]: fetched("macOS Catalina - Wikipedia"),
      [MOJAVE]: fetched("macOS Mojave - Wikipedia"),
    });
    server.docs.set("/api/safari/tabs", { tabs: ["", CATALINA], active: 1, rev: 3, session: "s1" });
    // Mail asks while Safari is closed: the request waits for a window.
    let asked: unknown = null;
    act(() => {
      asked = openUrl(MOJAVE, "mail");
    });
    expect(asked).toEqual({ url: MOJAVE, from: "mail" });
    render(<Safari />);
    // The kept tabs come back first, and the link opens in a third tab, in front.
    expect(await screen.findByTitle("macOS Mojave - Wikipedia")).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Favorites",
      "macOS Catalina - Wikipedia",
      "macOS Mojave - Wikipedia",
    ]);
    expect(field()).toHaveValue(MOJAVE);
    // It is kept with the others, so it is there after a reload; the queue is empty.
    await waitFor(() => {
      const saved = server.saves.filter((save) => save.url === "/api/safari/tabs").at(-1);
      expect(saved?.body).toEqual(
        expect.objectContaining({ tabs: ["", CATALINA, MOJAVE], active: 2 }),
      );
    });
    expect(takeOpenUrlRequests()).toEqual([]);
    // A refused address is never asked of Safari.
    act(() => {
      expect(openUrl("javascript:alert(1)", "notes")).toBeNull();
    });
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("shows a page opened before at the address it ended at, and Clear History empties Frequently Visited", async () => {
    const user = userEvent.setup();
    const HOME = "https://en.wikipedia.org/wiki/Main_Page";
    const server = fakeServer({
      "https://en.wikipedia.org/": { ...fetched("Wikipedia, the free encyclopedia"), url: HOME },
      [CATALINA]: fetched("macOS Catalina - Wikipedia"),
    });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    // A bare address opens the site's home page, and the field shows where it ended.
    await go(user, "en.wikipedia.org");
    await screen.findByTitle("Wikipedia, the free encyclopedia");
    expect(field()).toHaveValue(HOME);
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    // Typed again, it comes from the window's own pages, and the field still follows it.
    await go(user, "en.wikipedia.org");
    await screen.findByTitle("Wikipedia, the free encyclopedia");
    expect(field()).toHaveValue(HOME);
    expect(server.asked).toEqual(["https://en.wikipedia.org/", CATALINA]);

    await user.click(button("New Tab"));
    expect(await screen.findByRole("heading", { name: "Frequently Visited" })).toBeVisible();
    await user.click(button("Show All History"));
    const history = await screen.findByRole("region", { name: "History" });
    await within(history).findByText("NPR");
    await user.click(within(history).getByRole("button", { name: "Clear History…" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Clear History" }),
    );
    await within(history).findByText("No History");
    await user.click(button("New Tab"));
    await screen.findAllByRole("link", { name: "Wikipedia" });
    expect(screen.queryByRole("heading", { name: "Frequently Visited" })).not.toBeInTheDocument();
  });

  it("carries out its menu commands from the keyboard: tabs, location, Back, Forward, bookmark", async () => {
    // jsdom is not an Apple platform, so a menu's Command key is Control here
    // (`matchesMenuKeyEquivalent`); on a Mac it is Command.
    const user = userEvent.setup();
    const server = fakeServer({
      [CATALINA]: fetched("macOS Catalina - Wikipedia"),
      [MOJAVE]: fetched("macOS Mojave - Wikipedia"),
    });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    await go(user, MOJAVE);
    await screen.findByTitle("macOS Mojave - Wikipedia");
    // Back and Forward.
    await user.click(button("Show Reader View"));
    // A literal "[" is written "[[" in user-event's key syntax.
    await user.keyboard("{Control>}[[{/Control}");
    expect(await screen.findByTitle("macOS Catalina - Wikipedia")).toBeInTheDocument();
    expect(field()).toHaveValue(CATALINA);
    await user.keyboard("{Control>}]{/Control}");
    expect(await screen.findByTitle("macOS Mojave - Wikipedia")).toBeInTheDocument();
    // Open Location puts the keyboard in the field with its text selected.
    await user.keyboard("{Control>}l{/Control}");
    expect(field()).toHaveFocus();
    const input = field() as HTMLInputElement;
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, MOJAVE.length]);
    // New Tab, then Close Tab, then Reopen Last Closed Tab with its page.
    await user.keyboard("{Control>}t{/Control}");
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    await user.keyboard("{Control>}{Shift>}d{/Shift}{/Control}");
    await user.click(screen.getByRole("tab", { name: "macOS Mojave - Wikipedia" }));
    await user.keyboard("{Control>}w{/Control}");
    expect(screen.queryByRole("tab")).toBeNull();
    expect(await screen.findByRole("link", { name: "Wikipedia" })).toBeInTheDocument();
    await user.keyboard("{Control>}{Shift>}t{/Shift}{/Control}");
    expect(await screen.findByTitle("macOS Mojave - Wikipedia")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(button("Back")).toBeEnabled();
    // Add Bookmark from the keyboard saves the Favorites.
    await user.keyboard("{Control>}d{/Control}");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      const saved = server.saves.filter((save) => save.url === "/api/safari/bookmarks").at(-1);
      expect(saved?.body.favorites).toContainEqual({
        title: "macOS Mojave - Wikipedia",
        url: MOJAVE,
      });
    });
    // Hide Favorites Bar, once the sheet has let the keyboard go.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.keyboard("{Control>}{Shift>}b{/Shift}{/Control}");
    expect(screen.queryByRole("navigation", { name: "Favorites bar" })).toBeNull();
  });

  const setPreferences = (values: Record<string, string | boolean>) =>
    act(() => changeDesktopValue(SAFARI_SETTINGS, values));
  const press = (key: string) =>
    fireEvent.keyDown(screen.getByRole("region", { name: "Safari" }), { key, ctrlKey: true });
  const home = () =>
    fireEvent.keyDown(screen.getByRole("region", { name: "Safari" }), {
      key: "h",
      ctrlKey: true,
      shiftKey: true,
    });

  it("goes Home to the homepage Preferences hold, and to Favorites without one", async () => {
    const user = userEvent.setup();
    fakeServer({
      [CATALINA]: fetched("macOS Catalina - Wikipedia"),
      [MOJAVE]: fetched("macOS Mojave - Wikipedia"),
    });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    home();
    expect(await screen.findByRole("link", { name: "Wikipedia" })).toBeInTheDocument();
    expect(field()).toHaveValue("");
    setPreferences({ homepage: MOJAVE });
    home();
    expect(await screen.findByTitle("macOS Mojave - Wikipedia")).toBeInTheDocument();
    expect(field()).toHaveValue(MOJAVE);
  });

  it("opens a new tab on the page Preferences name", async () => {
    const user = userEvent.setup();
    fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    setPreferences({ tabs: "Same Page" });
    press("t");
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(field()).toHaveValue(CATALINA);
    setPreferences({ tabs: "Empty Page" });
    press("t");
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Untitled");
    expect(field()).toHaveValue("");
    expect(screen.queryByRole("link", { name: "Wikipedia" })).toBeNull();
  });

  it("lets Command-1 to Command-9 show tabs only when Preferences say so", async () => {
    const user = userEvent.setup();
    fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    setPreferences({ [TAB_KEYS]: true });
    press("t");
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Favorites");
    press("1");
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(
      "macOS Catalina - Wikipedia",
    );
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("opens a page with an article in Reader when Preferences say so", async () => {
    const user = userEvent.setup();
    fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    setPreferences({ [AUTO_READER]: true });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    expect(await screen.findByRole("button", { name: "Hide Reader View" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows the whole address in the field when Preferences say so, and the host otherwise", async () => {
    const user = userEvent.setup();
    fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    const { container } = render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    const shown = () => container.querySelector(".mac-smart-search-field-text")?.textContent;
    expect(shown()).toBe(new URL(CATALINA).hostname.replace(/^www\./, ""));
    setPreferences({ [FULL_ADDRESS]: true });
    expect(shown()).toBe(CATALINA);
  });

  it("forgets on the server what Remove history items says has grown too old", async () => {
    const stale = Date.now() - 2 * 86_400_000;
    fakeServer({});
    const answered = globalThis.fetch;
    const forgotten: unknown[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/api/safari/history/forget")) {
        forgotten.push(JSON.parse(String(init?.body)));
        return new Response("{}", { status: 200 });
      }
      if (String(url).endsWith("/api/safari/history")) {
        return Response.json({
          history: [{ url: CATALINA, title: "Old", at: stale, count: 2 }],
        });
      }
      return answered(url, init);
    });
    setPreferences({ history: "After one day" });
    render(<Safari />);
    await waitFor(() => expect(forgotten).toEqual([{ urls: [CATALINA] }]));
  });

  it("names a page in the Save As sheet, then saves it to Downloads under that name", async () => {
    const user = userEvent.setup();
    fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    press("s");
    const sheet = await screen.findByRole("dialog");
    expect(drive.uploads).toEqual([]);
    const name = within(sheet).getByRole("textbox", { name: "Save As:" });
    await user.clear(name);
    await user.type(name, "Catalina notes");
    await user.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(drive.uploads.map((upload) => upload.name)).toEqual(["Catalina notes.html"]),
    );
    expect(drive.uploads[0]?.parent).toBe("downloads");
    expect(drive.uploads[0]?.type).toBe("text/html");
  });

  const lastTabs = (server: ReturnType<typeof fakeServer>) =>
    server.saves.filter((save) => save.url === "/api/safari/tabs").at(-1)?.body;
  const lastLibrary = (server: ReturnType<typeof fakeServer>) =>
    server.saves.filter((save) => save.url === "/api/safari/bookmarks").at(-1)?.body;
  const dragged = (data: Record<string, string>) => ({
    dataTransfer: {
      types: Object.keys(data),
      files: [],
      getData: (type: string) => data[type] ?? "",
    },
  });

  it("has the keys that scroll move the page when nothing else has the keyboard, and not from a field", async () => {
    const user = userEvent.setup();
    fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    const frame = (await screen.findByTitle("macOS Catalina - Wikipedia")) as HTMLIFrameElement;
    // Return gave up the keyboard, and the window took it back for its keys.
    await waitFor(() => expect(screen.getByRole("region", { name: "Safari" })).toHaveFocus());
    const post = vi.spyOn(frame.contentWindow as Window, "postMessage");
    fireEvent.keyDown(document.body, { key: "PageDown" });
    expect(post).toHaveBeenLastCalledWith(
      { safari: 1, type: "scroll", key: "PageDown", shift: false },
      "*",
    );
    fireEvent.keyDown(document.body, { key: " ", shiftKey: true });
    expect(post).toHaveBeenLastCalledWith(
      { safari: 1, type: "scroll", key: " ", shift: true },
      "*",
    );
    fireEvent.keyDown(document.body, { key: "ArrowDown", ctrlKey: true });
    expect(post).toHaveBeenLastCalledWith(
      { safari: 1, type: "scroll", key: "End", shift: false },
      "*",
    );
    post.mockClear();
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(document.body, { key: "a" });
    expect(post).not.toHaveBeenCalled();
  });

  it("sends Find Next, Find Previous and Jump to Selection to the page, and clears its lit words at Done", async () => {
    const user = userEvent.setup();
    fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    const frame = (await screen.findByTitle("macOS Catalina - Wikipedia")) as HTMLIFrameElement;
    const page = frame.contentWindow as Window;
    const post = vi.spyOn(page, "postMessage");
    press("f");
    const find = await screen.findByRole("searchbox", { name: "Find in page" });
    await waitFor(() => expect(find).toHaveFocus());
    await user.type(find, "mac");
    expect(post).toHaveBeenLastCalledWith(
      { safari: 1, type: "find", query: "mac", fresh: true },
      "*",
    );
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { safari: 1, type: "found", query: "mac", count: 3, hit: true, fresh: true },
          source: page,
        }),
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent("1 of 3 matches");
    press("g");
    expect(post).toHaveBeenLastCalledWith(
      { safari: 1, type: "find", query: "mac", back: false },
      "*",
    );
    fireEvent.keyDown(screen.getByRole("region", { name: "Safari" }), {
      key: "g",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(post).toHaveBeenLastCalledWith(
      { safari: 1, type: "find", query: "mac", back: true },
      "*",
    );
    press("j");
    expect(post).toHaveBeenLastCalledWith({ safari: 1, type: "jump" }, "*");
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(post).toHaveBeenCalledWith({ safari: 1, type: "find", query: "", fresh: true }, "*");
  });

  it("finds in Reader and on Safari's own pages, counting here, and has nothing to find on the start page", async () => {
    const user = userEvent.setup();
    fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    press("f");
    expect(screen.queryByRole("searchbox", { name: "Find in page" })).toBeNull();
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    await user.click(button("Show Reader View"));
    await screen.findByText(/First paragraph/);
    press("f");
    const search = await screen.findByRole("searchbox", { name: "Find in page" });
    await waitFor(() => expect(search).toHaveFocus());
    await user.type(search, "paragraph");
    expect(screen.getByRole("status")).toHaveTextContent("1 of 3 matches");
    await user.type(search, "{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("2 of 3 matches");
    await user.type(search, "{Shift>}{Enter}{/Shift}{Shift>}{Enter}{/Shift}");
    expect(screen.getByRole("status")).toHaveTextContent("3 of 3 matches");
    await user.clear(search);
    await user.type(search, "zebra");
    expect(screen.getByRole("status")).toHaveTextContent("Not Found");
    press("y");
    expect(await screen.findByRole("heading", { name: "History" })).toBeVisible();
    expect(screen.queryByRole("searchbox", { name: "Find in page" })).toBeNull();
    press("f");
    const again = await screen.findByRole("searchbox", { name: "Find in page" });
    await waitFor(() => expect(again).toHaveFocus());
    await user.type(again, "catalina");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 match"));
  });

  it("takes dragged text in the field as a search, and a picture's bytes as nothing", async () => {
    fakeServer({});
    const server = fakeServer({
      [`${SEARCH}macOS+Catalina`]: fetched("Search results"),
    });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    fireEvent.drop(field(), dragged({ "text/plain": "macOS Catalina" }));
    expect(await screen.findByTitle("Search results")).toBeInTheDocument();
    expect(server.asked).toEqual([`${SEARCH}macOS+Catalina`]);
    fireEvent.drop(field(), dragged({ "text/uri-list": "data:image/png;base64,AAAA" }));
    expect(server.asked).toHaveLength(1);
  });

  it("drags the page from the field at rest, and a link joins the Favorites bar where it is let go", async () => {
    const user = userEvent.setup();
    const server = fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    expect(field()).not.toHaveAttribute("draggable", "true");
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    expect(field()).toHaveAttribute("draggable", "true");
    const carried = new Map<string, string>();
    fireEvent.dragStart(field(), {
      dataTransfer: { setData: (type: string, value: string) => carried.set(type, value) },
    });
    expect(carried.get("text/uri-list")).toBe(CATALINA);
    expect(carried.get("application/x-macalicious-link-title")).toBe("macOS Catalina - Wikipedia");
    press("l");
    expect(field()).toHaveAttribute("draggable", "false");

    const bar = screen.getByRole("navigation", { name: "Favorites bar" });
    fireEvent.drop(within(bar).getByText("NPR"), dragged(Object.fromEntries(carried)));
    await waitFor(() =>
      expect(lastLibrary(server)?.favorites).toEqual([
        { title: "Wikipedia", url: "https://en.wikipedia.org/wiki/Main_Page" },
        { title: "macOS Catalina - Wikipedia", url: CATALINA },
        { title: "NPR", url: "https://text.npr.org/" },
      ]),
    );
  });

  it("carries a link dragged out of the page to the tab bar, the field and the Favorites bar", async () => {
    const user = userEvent.setup();
    const server = fakeServer({
      [CATALINA]: fetched("macOS Catalina - Wikipedia"),
      [MOJAVE]: fetched("macOS Mojave - Wikipedia"),
    });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    await user.click(button("Show Tab Overview"));
    await user.click(screen.getByRole("button", { name: "New Tab" }));
    await user.click(screen.getByRole("tab", { name: "macOS Catalina - Wikipedia" }));
    const frame = (await screen.findByTitle("macOS Catalina - Wikipedia")) as HTMLIFrameElement;
    const drag = (phase: string, extra: Record<string, unknown> = {}) =>
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { safari: 1, type: "link-drag", phase, x: 5, y: 5, ...extra },
            source: frame.contentWindow,
          }),
        );
      });
    const carry = (over: Element, url: string, title: string) => {
      document.elementFromPoint = () => over;
      drag("start", { url, title });
      expect(document.querySelector(".mac-desktop-drag-name")).toHaveTextContent(title);
      drag("move");
      drag("end");
      expect(document.querySelector(".mac-desktop-drag")).toBeNull();
    };
    const bar = screen.getByRole("navigation", { name: "Favorites bar" });
    carry(within(bar).getByText("NPR"), MOJAVE, "Mojave");
    await waitFor(() =>
      expect(lastLibrary(server)?.favorites).toEqual([
        { title: "Wikipedia", url: "https://en.wikipedia.org/wiki/Main_Page" },
        { title: "Mojave", url: MOJAVE },
        { title: "NPR", url: "https://text.npr.org/" },
      ]),
    );
    carry(screen.getByRole("tablist"), MOJAVE, "Mojave");
    expect(await screen.findAllByRole("tab")).toHaveLength(3);
    // An address no window may open carries nothing.
    document.elementFromPoint = () => screen.getByRole("tablist");
    drag("start", { url: "javascript:alert(1)", title: "Bad" });
    expect(document.querySelector(".mac-desktop-drag")).toBeNull();
    drag("end");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("reorders the sidebar's rows by dragging, moves one into a folder, and a plain click opens one", async () => {
    const user = userEvent.setup();
    const server = fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    const link = (title: string, url: string) => ({ title, url });
    const a = link("Catalina", CATALINA);
    const b = link("Mojave", MOJAVE);
    const c = link("NPR text", "https://text.npr.org/x");
    server.docs.set("/api/safari/bookmarks", {
      favorites: [],
      bookmarks: [a, b, c],
      folders: [{ title: "Work", links: [] }],
      rev: 1,
      session: "s1",
    });
    render(<Safari />);
    await user.click(await screen.findByRole("button", { name: "Show Sidebar" }));
    const row = (name: string) => screen.getByRole("treeitem", { name });
    await screen.findByRole("treeitem", { name: "NPR text" });
    const drag = (from: HTMLElement, to: HTMLElement) => {
      fireEvent.pointerDown(from, { button: 0, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(to, { clientX: 10, clientY: 60 });
      fireEvent.pointerUp(to, { clientX: 10, clientY: 60 });
    };
    drag(row("NPR text"), row("Catalina"));
    await waitFor(() => expect(lastLibrary(server)?.bookmarks).toEqual([c, a, b]));
    drag(row("Mojave"), row("Work"));
    await waitFor(() => expect(lastLibrary(server)?.bookmarks).toEqual([c, a]));
    expect(lastLibrary(server)?.folders).toEqual([{ title: "Work", links: [b] }]);
    expect(server.asked).toEqual([]);
    await user.click(row("Catalina"));
    expect(await screen.findByTitle("macOS Catalina - Wikipedia")).toBeInTheDocument();
    expect(server.asked).toEqual([CATALINA]);
  });

  it("keeps a tab's Back and Forward across a reload, and Clear History forgets them", async () => {
    const user = userEvent.setup();
    const server = fakeServer({
      [CATALINA]: fetched("macOS Catalina - Wikipedia"),
      [MOJAVE]: fetched("macOS Mojave - Wikipedia"),
    });
    const first = render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await waitFor(() => expect(server.documentReads).toContain("/api/safari/tabs"));
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    await go(user, MOJAVE);
    await screen.findByTitle("macOS Mojave - Wikipedia");
    await waitFor(() =>
      expect(lastTabs(server)?.histories).toEqual([{ pages: ["", CATALINA, MOJAVE], index: 2 }]),
    );
    first.unmount();
    render(<Safari />);
    expect(await screen.findByTitle("macOS Mojave - Wikipedia")).toBeInTheDocument();
    await waitFor(() => expect(button("Back")).toBeEnabled());
    await user.click(button("Back"));
    expect(await screen.findByTitle("macOS Catalina - Wikipedia")).toBeInTheDocument();
    expect(button("Forward")).toBeEnabled();

    press("y");
    await user.click(await screen.findByRole("button", { name: "Clear History…" }));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Clear History" }));
    await waitFor(() => expect(lastTabs(server)?.histories).toBeUndefined());
    expect(field()).toHaveValue("");
    expect(button("Back")).toHaveAttribute("aria-disabled", "true");
  });

  it("shows a pinned tab in every window that is not private, on the same page, until it is unpinned", async () => {
    const user = userEvent.setup();
    fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    const one = render(<Safari />);
    await within(one.container).findByRole("link", { name: "Wikipedia" });
    const two = render(<Safari />);
    const inPrivate = render(<Safari opening={{ isPrivate: true }} />);
    const field1 = within(one.container).getByRole("textbox", {
      name: "Search or enter website name",
    });
    await user.click(field1);
    await user.type(field1, `${CATALINA}{Enter}`);
    await within(one.container).findByTitle("macOS Catalina - Wikipedia");
    await user.click(within(one.container).getByRole("button", { name: "Show Tab Overview" }));
    await user.click(within(one.container).getByRole("button", { name: "New Tab" }));
    fireEvent.contextMenu(
      within(one.container).getByRole("tab", { name: "macOS Catalina - Wikipedia" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Pin Tab" }));
    expect(
      await within(two.container).findByRole("tab", { name: "en.wikipedia.org, pinned" }),
    ).toBeInTheDocument();
    expect(within(inPrivate.container).queryByRole("tab")).toBeNull();
    fireEvent.contextMenu(
      within(one.container).getByRole("tab", { name: "macOS Catalina - Wikipedia, pinned" }),
    );
    expect(await screen.findByRole("menuitem", { name: "Move Tab to New Window" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(await screen.findByRole("menuitem", { name: "Unpin Tab" }));
    await waitFor(() => expect(within(two.container).queryByRole("tab")).toBeNull());
    expect(within(one.container).getAllByRole("tab")).toHaveLength(2);
  });

  it("shows an HTML file made safe by the server, as a page no bookmark can name", async () => {
    const user = userEvent.setup();
    const server = fakeServer({});
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    const picker = document.querySelector<HTMLInputElement>('input[aria-label="Open File"]');
    await user.upload(
      picker as HTMLInputElement,
      new File(["<h1>My notes</h1>"], "my notes.html", { type: "text/html" }),
    );
    const frame = await screen.findByTitle("My notes");
    expect(frame.getAttribute("srcdoc")).toBe("<p>My notes</p>");
    expect(server.extras.fileBodies).toEqual([{ html: "<h1>My notes</h1>" }]);
    expect(field()).toHaveValue("file:///my%20notes.html");
    await waitFor(() => expect(lastTabs(server)?.tabs).toEqual(["", ""]));
    press("d");
    expect(screen.queryByRole("dialog")).toBeNull();

    server.extras.filePage = { ok: false, kind: "too-large", host: "", message: "" };
    act(() => {
      openFile({ id: "page-1", name: "big.htm" }, "safari");
    });
    expect(await screen.findByRole("tab", { name: "big.htm" })).toBeInTheDocument();
    expect(await screen.findByText(/can’t open/)).toBeInTheDocument();
    expect(server.extras.fileBodies.at(-1)).toEqual({ html: "<p>From the drive</p>" });
  });

  it("lists HTML files and saved links in Open File, and opens one", async () => {
    const user = userEvent.setup();
    const server = fakeServer({});
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    press("o");
    const sheet = await screen.findByRole("dialog", { name: "Open File" });
    expect(within(sheet).getByRole("button", { name: "From This Computer…" })).toBeVisible();
    await user.dblClick(await within(sheet).findByText("saved page.html"));
    expect(await screen.findByTitle("My notes")).toBeInTheDocument();
    expect(server.extras.fileBodies).toEqual([{ html: "<p>From the drive</p>" }]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("takes HTML files and saved links dragged from Finder, and refuses other files, saying why", async () => {
    const server = fakeServer({});
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    const area = document.querySelector(".mac-safari-content");
    const over = (name: string) =>
      landingAt(area, {
        from: "finder",
        copy: false,
        items: [{ id: "page-2", name, kind: "file" }],
      });
    expect(over("photo.jpg")?.refusal).toBe(
      "Safari shows web pages: an HTML file or a saved link.",
    );
    act(() => over("page.html")?.drop());
    expect(await screen.findByTitle("My notes")).toBeInTheDocument();
    expect(server.extras.fileBodies).toEqual([{ html: "<p>From the drive</p>" }]);
    const own = new File(["<p>Dropped</p>"], "dropped.html", { type: "text/html" });
    fireEvent.drop(screen.getByRole("region", { name: "Safari" }), {
      dataTransfer: { types: ["Files"], files: [own], getData: () => "" },
    });
    await waitFor(() => expect(server.extras.fileBodies).toHaveLength(2));
    expect(server.extras.fileBodies[1]).toEqual({ html: "<p>Dropped</p>" });
  });

  it("adds what the search engine suggests for typed words, unless it is an address, off or private", async () => {
    const user = userEvent.setup();
    const server = fakeServer({ [`${SEARCH}MacOS+Catalina`]: fetched("Search results") });
    server.extras.suggestions = ["MacOS Catalina", "macos"];
    const shown = render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await user.click(field());
    await user.type(field(), "en.wikipedia.org");
    await new Promise((done) => setTimeout(done, 260));
    expect(server.extras.suggested).toEqual([]);
    await user.clear(field());
    await user.type(field(), "macos");
    const row = await screen.findByRole("option", { name: /MacOS Catalina/ });
    expect(row).toHaveTextContent("Wikipedia");
    expect(server.extras.suggested).toEqual(["macos"]);
    await user.click(row);
    expect(await screen.findByTitle("Search results")).toBeInTheDocument();
    shown.unmount();

    server.extras.suggested.length = 0;
    setPreferences({ [ENGINE_SUGGESTIONS]: false });
    const off = render(<Safari />);
    await user.click(field());
    await user.type(field(), "macos");
    await new Promise((done) => setTimeout(done, 260));
    off.unmount();
    setPreferences({});
    render(<Safari opening={{ isPrivate: true }} />);
    await user.click(field());
    await user.type(field(), "macos");
    await new Promise((done) => setTimeout(done, 260));
    expect(server.extras.suggested).toEqual([]);
  });

  it("keeps a Command-click behind unless Preferences say otherwise, and a pinned tab on its site", async () => {
    const user = userEvent.setup();
    const NEWS = "https://news.ycombinator.com/";
    fakeServer({
      [CATALINA]: fetched("macOS Catalina - Wikipedia"),
      [MOJAVE]: fetched("macOS Mojave - Wikipedia"),
      [NEWS]: fetched("Hacker News"),
    });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    const link = async (url: string, newTab: boolean) => {
      const frame = document.querySelector("iframe") as HTMLIFrameElement;
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { safari: 1, type: "navigate", url, newTab },
            source: frame.contentWindow,
          }),
        );
      });
    };
    await screen.findByTitle("macOS Catalina - Wikipedia");
    await link(NEWS, true);
    expect(await screen.findByRole("tab", { name: "Hacker News" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(field()).toHaveValue(CATALINA);

    fireEvent.contextMenu(screen.getByRole("tab", { name: "macOS Catalina - Wikipedia" }));
    await user.click(await screen.findByRole("menuitem", { name: "Pin Tab" }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    await link(MOJAVE, false);
    await waitFor(() => expect(field()).toHaveValue(MOJAVE));
    await waitFor(() =>
      expect(document.querySelector("iframe")?.title).toBe("macOS Mojave - Wikipedia"),
    );
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    await link(NEWS, false);
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(3));
    expect(field()).toHaveValue(MOJAVE);
  });

  it("has Open Image dimmed, Copy Image and Look Up in the menu of what a right-click found", async () => {
    const user = userEvent.setup();
    fakeServer({ [CATALINA]: fetched("macOS Catalina - Wikipedia") });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    const frame = document.querySelector("iframe") as HTMLIFrameElement;
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            safari: 1,
            type: "menu",
            x: 5,
            y: 5,
            image: "data:image/png;base64,iVBORw0KGgo=",
            text: "catalina",
          },
          source: frame.contentWindow,
        }),
      );
    });
    const open = await screen.findByRole("menuitem", { name: "Open Image in New Tab" });
    expect(open).toHaveAttribute("aria-disabled", "true");
    expect(open.getAttribute("title")).toContain("no address of its own");
    expect(screen.getByRole("menuitem", { name: "Copy Image" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Look Up “catalina”" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    const effects: unknown[] = [];
    const hear = (event: Event) => effects.push((event as CustomEvent).detail);
    window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
    await user.click(screen.getByRole("menuitem", { name: "Look Up “catalina”" }));
    window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear);
    expect(effects).toEqual([[{ open: "dictionary" }]]);
  });

  it("has its tab menu's bookmark and mute rows", async () => {
    const user = userEvent.setup();
    fakeServer({
      [CATALINA]: fetched("macOS Catalina - Wikipedia"),
      [MOJAVE]: fetched("macOS Mojave - Wikipedia"),
    });
    render(<Safari />);
    await screen.findByRole("link", { name: "Wikipedia" });
    await go(user, CATALINA);
    await screen.findByTitle("macOS Catalina - Wikipedia");
    press("t");
    const first = screen.getByRole("tab", { name: "macOS Catalina - Wikipedia" });
    fireEvent.contextMenu(first);
    expect(
      await screen.findByRole("menuitem", { name: "Add Bookmarks for These Tabs…" }),
    ).toBeInTheDocument();
    const mute = screen.getByRole("menuitem", { name: "Mute Tab" });
    expect(mute).toHaveAttribute("aria-disabled", "true");
    expect(mute.getAttribute("title")).toContain("Pages here make no sound");
  });

  it("dims what it cannot carry out in Preferences, saying why, and keeps what it can", async () => {
    const user = userEvent.setup();
    render(<SafariPreferences animated={false} />);
    expect(screen.getByRole("textbox", { name: "Homepage:" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "File download location:" })).toHaveAttribute(
      "title",
      "Safari saves every download to your Downloads folder on the drive.",
    );
    await user.click(screen.getByRole("tab", { name: "Search" }));
    expect(screen.getByRole("combobox", { name: "Search engine:" })).toHaveTextContent("Wikipedia");
    expect(
      screen.getByText("Searches go to Wikipedia, the one search the server may fetch."),
    ).toBeVisible();
    expect(screen.getByRole("checkbox", { name: ENGINE_SUGGESTIONS })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: ENGINE_SUGGESTIONS })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("tab", { name: "Privacy" }));
    expect(screen.getByRole("button", { name: "Manage Website Data…" })).toBeDisabled();
    expect(screen.getByText(/keeps no cookie/)).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Tabs" }));
    await user.click(screen.getByRole("checkbox", { name: MAKE_ACTIVE }));
    expect(screen.getByRole("checkbox", { name: MAKE_ACTIVE })).toBeChecked();
  });
});
