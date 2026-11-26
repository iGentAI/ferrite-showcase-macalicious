import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextEdit } from "./textedit";
import { draftFromServer, htmlToContent } from "./textedit-server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const DRAFT_URL = "/api/textedit/draft";

/** The person's drive, empty: what `/api/files/` answers a fresh desktop. */
const DRIVE = {
  rev: 1,
  entries: ["Desktop", "Documents", "Downloads", "Movies", "Music", "Pictures"].map((name) => ({
    id: name.toLowerCase(),
    name,
    kind: "folder",
    size: 0,
    created_ms: 1,
    modified_ms: 1,
  })),
  usage: 0,
  quota: 1_000_000,
  piece_bytes: 1 << 20,
  max_file_bytes: 1 << 24,
  max_entries: 100,
};

/** The answer to a read of `url`: the drive's, or the draft's. */
const answerFor = (url: string, draft: unknown) =>
  String(url).startsWith("/api/files/") ? { ...DRIVE, session: `s-${Math.random()}` } : draft;

function serve(draft: unknown) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const fetch = vi.fn(async (url: string, init?: RequestInit) =>
    init?.method === "PUT"
      ? { ok: true, json: async () => JSON.parse(String(init.body)) }
      : { ok: true, json: async () => answerFor(url, draft) },
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const saves = (fetch: ReturnType<typeof serve>, url: string) =>
  fetch.mock.calls
    .filter(([to, init]) => init?.method === "PUT" && to === url)
    .map(([, init]) => JSON.parse(String(init?.body)));

const editor = () => screen.getByRole("textbox", { name: "Document" });
const body = () => document.querySelector(".mac-textedit-body") as HTMLElement;

/** Replace the document's paragraphs, as typing would. */
const write = (...lines: string[]) => {
  const node = editor();
  node.replaceChildren(
    ...lines.map((line) => {
      const element = document.createElement("div");
      element.append(line);
      return element;
    }),
  );
  fireEvent.input(node);
};

const LETTER = {
  name: "Letter",
  format: "rich",
  lines: ["Dear Ada,", "Yours"],
  html: '<div style="text-align: right"><b>Dear Ada,</b></div><div>Yours</div>',
  edited: true,
};

describe("TextEdit on the desktop's Ferrite application", () => {
  it("opens a stored document with every style the format bar, the menu and the panels set", () => {
    // The view's HTML as Chromium, Firefox and WebKit write those styles (styleWithCSS).
    const styled =
      '<div style="text-align: center;">Here\'s to the <span style="font-weight: bold; font-style: italic; text-decoration-line: underline line-through; font-family: Georgia, serif; color: rgb(255, 59, 48); background-color: rgb(255, 234, 0);"><font style="font-size: 13px;">crazy</font></span> ones...</div>' +
      "<div><b>bold</b> <i>italic</i> <u>under</u> <s>struck</s> <strike>old</strike></div>";
    const draft = draftFromServer(
      { draft: { name: "Styled", format: "rich", lines: ["x"], html: styled, edited: false } },
      document,
    );
    const view = document.createElement("div");
    view.append(draft?.document.content as DocumentFragment);
    const span = view.querySelector("span") as HTMLElement;
    expect(span.style.fontWeight).toBe("bold");
    expect(span.style.fontStyle).toBe("italic");
    expect(span.style.textDecorationLine).toBe("underline line-through");
    expect(span.style.fontFamily).toBe("Georgia, serif");
    expect(span.style.color).toBe("rgb(255, 59, 48)");
    expect(span.style.backgroundColor).toBe("rgb(255, 234, 0)");
    expect((view.querySelector("font") as HTMLElement).style.fontSize).toBe("13px");
    expect((view.firstChild as HTMLElement).style.textAlign).toBe("center");
    expect(view.querySelectorAll("b, i, u, s, strike")).toHaveLength(5);
  });

  it("rebuilds stored rich text from the view's own elements, styles and attributes only", () => {
    const content = htmlToContent(
      '<div style="text-align:center;background-image:url(x)" onclick="x()" data-list="disc">' +
        '<b>Hi</b><img src="x" onerror="alert(1)"><script>alert(2)</script><a href="javascript:x">there</a></div>',
      document,
    );
    const holder = document.createElement("div");
    holder.append(content);
    expect(holder.innerHTML).toBe(
      '<div style="text-align: center;" data-list="disc"><b>Hi</b>there</div>',
    );
  });

  it("keeps a web link and a Font row's style, and no other address", () => {
    const content = htmlToContent(
      '<div><a href="https://example.com/a" onclick="x()">web</a>' +
        '<a href="data:text/html,x">data</a>' +
        '<span style="letter-spacing: 0.5px; vertical-align: super; position: fixed">kept</span></div>' +
        '<div data-page-break=""><br></div>',
      document,
    );
    const holder = document.createElement("div");
    holder.append(content);
    expect(holder.innerHTML).toBe(
      '<div><a href="https://example.com/a">web</a>data' +
        '<span style="letter-spacing: 0.5px; vertical-align: super;">kept</span></div>' +
        '<div data-page-break=""><br></div>',
    );
  });

  it("reads only drafts in the module's shape, and the drive file one names", () => {
    expect(draftFromServer({ draft: null }, document)).toBeNull();
    expect(draftFromServer({ draft: { ...LETTER, edited: "yes" } }, document)).toBeUndefined();
    expect(draftFromServer({ draft: { ...LETTER, lines: [] } }, document)).toBeUndefined();
    expect(draftFromServer({ draft: LETTER }, document)?.document.lines).toEqual(LETTER.lines);
    const bound = { ...LETTER, file: { id: "abc123", name: "Letter.rtf" } };
    expect(draftFromServer({ draft: bound }, document)?.file).toEqual(bound.file);
    // The file's version comes back with it; one that is no version is dropped.
    const versioned = { ...LETTER, file: { id: "abc123", name: "Letter.rtf", version: 3 } };
    expect(draftFromServer({ draft: versioned }, document)?.file).toEqual(versioned.file);
    for (const version of [-1, 1.5, "3", null]) {
      const odd = { ...LETTER, file: { id: "abc123", name: "Letter.rtf", version } };
      expect(draftFromServer({ draft: odd }, document)?.file).toEqual(bound.file);
    }
    // A file id that could reach another route is not taken.
    const odd = { ...LETTER, file: { id: "../x", name: "Letter.rtf" } };
    expect(draftFromServer({ draft: odd }, document)?.file).toBeUndefined();
  });

  it("shows a dialog asked for while loading only once the reads have answered", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const answers: { url: string; resolve: (value: unknown) => void }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => new Promise((resolve) => answers.push({ url, resolve }))),
    );
    render(<TextEdit defaultDialog="save" />);
    // The reads go one after the other while the browser has no session cookie yet
    // (desktop-server.ts, sessionFetch): answer each as it comes, the draft's last.
    const answer = (draft: boolean) => {
      const at = answers.findIndex((each) => each.url.startsWith(DRAFT_URL) === draft);
      const [next] = answers.splice(at, 1);
      next?.resolve({ ok: true, json: async () => answerFor(next.url, { draft: null, rev: 0 }) });
    };
    await waitFor(() => expect(answers.length).toBeGreaterThan(0));
    if (answers.some((each) => !each.url.startsWith(DRAFT_URL))) answer(false);
    await waitFor(() => expect(answers.some((each) => each.url.startsWith(DRAFT_URL))).toBe(true));
    expect(screen.queryByRole("dialog", { name: "Save" })).toBeNull();
    answer(true);
    expect(await screen.findByRole("dialog", { name: "Save" })).toBeInTheDocument();
  });

  it("asks no server when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<TextEdit />);
    write("Changed");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("opens the session's document as it was left, and saves each edit", async () => {
    const fetch = serve({ draft: LETTER, rev: 3 });
    render(<TextEdit />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    expect(screen.getByRole("region", { name: "Letter — Edited" })).toBeInTheDocument();
    const paragraphs = [...editor().children] as HTMLElement[];
    expect(paragraphs.map((paragraph) => paragraph.textContent)).toEqual(["Dear Ada,", "Yours"]);
    expect(paragraphs[0]?.style.textAlign).toBe("right");
    expect(saves(fetch, DRAFT_URL)).toEqual([]);

    write("Dear Ada,", "Kind regards");
    await waitFor(() => {
      const last = saves(fetch, DRAFT_URL).at(-1);
      expect(last?.draft.lines).toEqual(["Dear Ada,", "Kind regards"]);
      expect(last?.draft.edited).toBe(true);
      expect(last?.draft.html).toContain("Kind regards");
    });
  });

  it("opens its own document again once the session's draft is forgotten elsewhere", async () => {
    const fetch = serve({ draft: LETTER, rev: 3 });
    render(<TextEdit />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    expect(screen.getByRole("region", { name: "Letter — Edited" })).toBeInTheDocument();
    // Another window loads after the draft was deleted: both show the starting document.
    fetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => answerFor(url, { draft: null, rev: 4 }),
    }));
    render(<TextEdit />);
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Letter — Edited" })).toBeNull(),
    );
  });

  it("saves nothing over a stored document it cannot read", async () => {
    const fetch = serve({ draft: { name: "Broken" }, rev: 1 });
    render(<TextEdit />);
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    write("Changed");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saves(fetch, DRAFT_URL)).toEqual([]);
  });
});
