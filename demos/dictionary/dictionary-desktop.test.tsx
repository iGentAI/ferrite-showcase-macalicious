import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DESKTOP_EFFECTS_EVENT } from "../desktop/desktop-effects";
import { beginDesktopValues, forgetDesktopValues } from "../desktop/desktop-personal";
import {
  DesktopDictionary,
  entryFromServer,
  historyFromServer,
  isLookUpKey,
  LOOK_UP_EVENT,
  lookUpWord,
  NOT_FOUND,
  selectedText,
  startLookUp,
  suggestionsFromServer,
  takePendingLookUp,
} from "./dictionary-desktop";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  takePendingLookUp();
  forgetDesktopValues();
  beginDesktopValues();
});

/** An entry as the module answered it under `ferrite dev` for "serendipity", shortened. */
const SERENDIPITY = {
  word: "serendipity",
  found: true,
  dictionary: {
    pronunciation: "/ˌsɛ.ɹən.ˈdɪ.pɪ.ti/",
    audio: "https://api.dictionaryapi.dev/media/pronunciations/en/serendipity-au.mp3",
    parts: [
      {
        part: "noun",
        senses: [
          {
            text: "The phenomenon of making an unplanned, fortunate discovery.",
            examples: ["It was pure serendipity that we met."],
          },
        ],
      },
      { part: "verb", senses: [{ text: "To find by luck.", examples: [] }] },
    ],
  },
  thesaurus: [
    { part: "noun", synonyms: ["chance", "luck"], antonyms: ["misfortune"] },
    { part: "adjective", synonyms: ["lucky"], antonyms: [] },
  ],
  wikipedia: {
    title: "Serendipity",
    extract: "Serendipity is an unplanned fortunate discovery.",
    url: "https://en.wikipedia.org/wiki/Serendipity",
  },
  credits: [
    {
      text: "Definitions from Wiktionary, CC BY-SA 4.0",
      href: "https://en.wiktionary.org/wiki/serendipity",
    },
    { text: "From Wikipedia, CC BY-SA 4.0", href: "https://en.wikipedia.org/wiki/Serendipity" },
  ],
  failed: [],
  at: 1,
};

const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const entry = (word: string) => screen.findByRole("region", { name: `Entry for ${word}` });

/**
 * Serves the module's routes from `entries`, counting the look-ups. As the module does, an entry
 * that found something says it was kept in the history (`remembered: true`) unless the fixture
 * says otherwise.
 */
function serve(entries: Record<string, unknown>, history: string[] = []) {
  const asked: string[] = [];
  const fetch = vi.fn(async (url: string) => {
    const { pathname, searchParams } = new URL(url, "http://desktop.test");
    if (pathname === "/api/dictionary/history")
      return json(200, { history: history.map((word) => ({ word, at: 1 })), rev: 1 });
    if (pathname === "/api/dictionary/suggest") {
      const prefix = searchParams.get("prefix") ?? "";
      return json(200, { prefix, words: Object.keys(entries).filter((w) => w.startsWith(prefix)) });
    }
    if (pathname === "/api/dictionary/entry") {
      const word = searchParams.get("word") ?? "";
      asked.push(word);
      const known = Object.hasOwn(entries, word)
        ? (entries[word] as Record<string, unknown>)
        : undefined;
      return json(
        200,
        known
          ? { ...(known.found === true ? { remembered: true } : {}), ...known }
          : {
              word,
              found: false,
              dictionary: null,
              thesaurus: [],
              wikipedia: null,
              credits: [],
              failed: [],
            },
      );
    }
    return json(404, { error: "no route" });
  });
  vi.stubGlobal("fetch", fetch);
  return asked;
}

describe("Dictionary on the desktop's Ferrite application", () => {
  it("reads the module's entries into the window's shape", () => {
    const read = entryFromServer(SERENDIPITY);
    expect(read?.dictionary?.part).toBe("noun");
    expect(read?.dictionary?.senses[0]?.examples).toEqual(["It was pure serendipity that we met."]);
    expect(read?.dictionary?.more?.[0]?.part).toBe("verb");
    expect(read?.dictionary?.audio).toMatch(/^https:\/\//);
    expect(read?.thesaurus?.synonyms).toEqual(["chance", "luck"]);
    expect(read?.thesaurus?.more?.[0]?.part).toBe("adjective");
    expect(read?.wikipediaUrl).toBe("https://en.wikipedia.org/wiki/Serendipity");
    // Only a Wikipedia article is offered as one: by its host and path, not by its text.
    for (const url of [
      "https://evil.example/#.wikipedia.org/wiki/x",
      "https://evil.example/wiki/Serendipity",
      "http://en.wikipedia.org/wiki/Serendipity",
    ]) {
      const unsafe = entryFromServer({
        ...SERENDIPITY,
        wikipedia: { ...SERENDIPITY.wikipedia, url },
      });
      expect(unsafe?.wikipediaUrl, url).toBeUndefined();
      expect(unsafe?.wikipedia).toBe("Serendipity is an unplanned fortunate discovery.");
    }
    expect(read?.credits).toHaveLength(2);
    expect(read?.status).toBeUndefined();

    const missing = { word: "qq", found: false, dictionary: null, thesaurus: [], wikipedia: null };
    expect(entryFromServer({ ...missing, failed: [] })?.status).toBe(NOT_FOUND);
    expect(entryFromServer({ ...missing, failed: ["dictionary"] })?.status).toMatch(
      /could not be reached/,
    );
    expect(entryFromServer({ word: "x" })).toBeUndefined();
    // An address that is not https is not linked.
    const plain = entryFromServer({
      ...SERENDIPITY,
      wikipedia: { ...SERENDIPITY.wikipedia, url: "javascript:alert(1)" },
    });
    expect(plain?.wikipediaUrl).toBeUndefined();

    expect(suggestionsFromServer({ words: ["computer", "a/b", 3] })).toEqual(["computer"]);
    expect(historyFromServer({ history: [{ word: "luck", at: 1 }, { at: 2 }], rev: 2 })).toEqual([
      "luck",
    ]);
    expect(historyFromServer({ history: null, rev: 0 })).toEqual([]);
    expect(lookUpWord("  ice   cream ")).toBe("ice cream");
    expect(lookUpWord("what?")).toBeUndefined();
  });

  it("looks up the word it opens on and shows every source with its credits", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const asked = serve({ serendipity: SERENDIPITY });
    render(<DesktopDictionary defaultQuery="serendipity" defaultScope="all" />);
    const shown = within(await entry("serendipity"));
    expect(
      await shown.findByText("The phenomenon of making an unplanned, fortunate discovery."),
    ).toBeVisible();
    expect(shown.getByText("It was pure serendipity that we met.")).toBeVisible();
    expect(shown.getByRole("button", { name: "chance" }).parentElement).toHaveTextContent(
      "chance, luck.",
    );
    expect(shown.getByText("misfortune").parentElement).toHaveTextContent("ANTONYMS misfortune.");
    expect(shown.getByRole("link", { name: "Read More on Wikipedia" })).toHaveAttribute(
      "href",
      "https://en.wikipedia.org/wiki/Serendipity",
    );
    expect(shown.getByRole("link", { name: /Wiktionary, CC BY-SA 4.0/ })).toBeVisible();
    expect(shown.getByRole("button", { name: "Listen to serendipity" })).toBeVisible();
    expect(asked).toEqual(["serendipity"]);
  });

  it("lists the server's suggestions for what is typed and says when nothing knows a word", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    serve({ serendipity: SERENDIPITY, serene: { ...SERENDIPITY, word: "serene" } });
    render(<DesktopDictionary defaultQuery="" />);
    const field = screen.getByRole("searchbox", { name: "Search" });
    await user.type(field, "sere");
    const list = screen.getByRole("listbox", { name: "Words" });
    await waitFor(() =>
      expect(within(list).getByRole("option", { name: "serendipity" })).toBeInTheDocument(),
    );
    const shown = within(await entry("sere"));
    await waitFor(() => expect(shown.getByRole("status")).toHaveTextContent(NOT_FOUND));
  });

  it("lists the person's recent look-ups while the field is empty", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({ serendipity: SERENDIPITY }, ["serendipity", "luck"]);
    render(<DesktopDictionary defaultQuery="" />);
    const list = screen.getByRole("listbox", { name: "Words" });
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(2));
    expect(within(list).getAllByRole("option")[0]).toHaveTextContent("serendipity");
  });

  it("Look Up takes the selected text to Dictionary and asks the desktop to open it", async () => {
    const opened: unknown[] = [];
    const named: unknown[] = [];
    const open = (event: Event) => opened.push((event as CustomEvent).detail);
    const name = (event: Event) => named.push((event as CustomEvent).detail);
    window.addEventListener(DESKTOP_EFFECTS_EVENT, open);
    window.addEventListener(LOOK_UP_EVENT, name);
    const stop = startLookUp(window);
    try {
      render(<textarea aria-label="Text" defaultValue="a serendipity found" />);
      const text = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Text" });
      text.focus();
      text.setSelectionRange(2, 13);
      expect(selectedText()).toBe("serendipity");
      fireEvent.keyDown(text, { code: "KeyD", key: "d", ctrlKey: true, metaKey: true });
      // Asked of the desktop as an effect, the one way the desktop opens an app for another.
      expect(opened).toEqual([[{ open: "dictionary" }]]);
      expect(named).toEqual([{ word: "serendipity" }]);
      expect(takePendingLookUp()).toBe("serendipity");
      // Nothing selected: nothing is looked up.
      text.setSelectionRange(0, 0);
      fireEvent.keyDown(text, { code: "KeyD", key: "d", ctrlKey: true, altKey: true });
      expect(opened).toHaveLength(1);
    } finally {
      stop();
      window.removeEventListener(DESKTOP_EFFECTS_EVENT, open);
      window.removeEventListener(LOOK_UP_EVENT, name);
    }
    expect(isLookUpKey({ ctrlKey: true, metaKey: false, altKey: false, code: "KeyD" })).toBe(false);
  });

  it("Look Up never reads a password or other credential field", () => {
    const opened: unknown[] = [];
    const open = (event: Event) => opened.push((event as CustomEvent).detail);
    window.addEventListener(DESKTOP_EFFECTS_EVENT, open);
    const stop = startLookUp(window);
    try {
      render(
        <>
          <input aria-label="Password" type="password" defaultValue="hunter2secret" />
          <input aria-label="Code" type="text" autoComplete="one-time-code" defaultValue="123456" />
        </>,
      );
      for (const name of ["Password", "Code"]) {
        const field = screen.getByLabelText<HTMLInputElement>(name);
        field.focus();
        field.select();
        expect(selectedText()).toBe("");
        fireEvent.keyDown(field, { code: "KeyD", key: "d", ctrlKey: true, metaKey: true });
      }
      expect(opened).toEqual([]);
      expect(takePendingLookUp()).toBeNull();
    } finally {
      stop();
      window.removeEventListener(DESKTOP_EFFECTS_EVENT, open);
    }
  });

  it("comes back on the step it was left on, however far back and however long its words", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const words = Array.from({ length: 20 }, (_, at) => `${"é".repeat(70)} ${at}`);
    serve({});
    const first = render(<DesktopDictionary defaultQuery="" />);
    for (const word of words) {
      act(() => {
        window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word } }));
      });
    }
    const back = () => screen.getByRole("button", { name: "Back" });
    for (let steps = 0; steps < 17; steps++) fireEvent.click(back());
    const field = () => screen.getByRole("searchbox", { name: "Search" });
    expect(field()).toHaveValue(words[2]);
    first.unmount();

    render(<DesktopDictionary defaultQuery="" />);
    await waitFor(() => expect(field()).toHaveValue(words[2]));
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(field()).toHaveValue(words[3]);
    fireEvent.click(back());
    fireEvent.click(back());
    expect(field()).toHaveValue(words[1]);
  });

  it("comes back on the word Look Up opened it on", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({ serendipity: SERENDIPITY });
    const first = render(<DesktopDictionary defaultQuery="luck" />);
    first.unmount();
    render(<DesktopDictionary defaultQuery="serendipity" />);
    const field = () => screen.getByRole("searchbox", { name: "Search" });
    expect(field()).toHaveValue("serendipity");
    cleanup();
    render(<DesktopDictionary defaultQuery="" />);
    await waitFor(() => expect(field()).toHaveValue("serendipity"));
  });

  it("keeps the start of a search too long for any word", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({});
    const first = render(<DesktopDictionary defaultQuery="" />);
    const field = () => screen.getByRole("searchbox", { name: "Search" });
    fireEvent.change(field(), { target: { value: "🍎".repeat(100_000) } });
    first.unmount();
    render(<DesktopDictionary defaultQuery="" />);
    await waitFor(() => expect(field()).toHaveValue("🍎".repeat(200)));
  });

  it("Clear Recents waits for a look-up of any window, and empties every window's list", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({ serendipity: SERENDIPITY }, ["serendipity", "luck"]);
    const served = globalThis.fetch as unknown as (
      url: string,
      init?: RequestInit,
    ) => Promise<unknown>;
    let release: (() => void) | undefined;
    const order: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url.includes("/entry") && !url.includes("history=0")) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        order.push("entry answered");
      }
      if (init?.method === "DELETE") {
        order.push("delete");
        return new Response(JSON.stringify({ history: null, rev: 1 }), { status: 200 });
      }
      return served(url, init);
    });
    render(
      <>
        <DesktopDictionary defaultQuery="" />
        <DesktopDictionary defaultQuery="" />
      </>,
    );
    const [one, two] = screen.getAllByRole("listbox", { name: "Words" }) as [
      HTMLElement,
      HTMLElement,
    ];
    await within(one).findByRole("option", { name: "luck" });
    await within(two).findByRole("option", { name: "luck" });
    // The second window asks for a word; it has not answered when the first clears the recents.
    fireEvent.mouseDown(within(two).getByRole("option", { name: "luck" }));
    await waitFor(() => expect(release).toBeDefined());
    fireEvent.contextMenu(within(one).getByRole("option", { name: "luck" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Clear Recents" }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(order).toEqual([]);
    act(() => release?.());
    await waitFor(() => expect(order).toEqual(["entry answered", "delete"]));
    await waitFor(() => {
      expect(within(one).queryAllByRole("option")).toEqual([]);
      expect(within(two).queryAllByRole("option")).toEqual([]);
    });
  });

  it("a word still waiting for typing to rest when Clear Recents begins stays out of the history", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({ serendipity: SERENDIPITY, luck: { ...SERENDIPITY, word: "luck" } }, ["serendipity"]);
    const served = globalThis.fetch as unknown as (
      url: string,
      init?: RequestInit,
    ) => Promise<unknown>;
    const asked: string[] = [];
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      asked.push(url);
      return init?.method === "DELETE"
        ? Promise.resolve(new Response("{}", { status: 200 }))
        : served(url, init);
    });
    render(
      <>
        <DesktopDictionary defaultQuery="" />
        <DesktopDictionary defaultQuery="" />
      </>,
    );
    const [one] = screen.getAllByRole("listbox", { name: "Words" }) as [HTMLElement];
    await within(one).findByRole("option", { name: "serendipity" });
    const [, second] = screen.getAllByRole("searchbox", { name: "Search" }) as [
      HTMLElement,
      HTMLElement,
    ];
    fireEvent.change(second, { target: { value: "luck" } });
    fireEvent.contextMenu(within(one).getByRole("option", { name: "serendipity" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Clear Recents" }));
    await waitFor(() => expect(asked.some((url) => url.includes("word=luck"))).toBe(true));
    expect(asked.filter((url) => url.includes("word=luck"))).toEqual([
      expect.stringContaining("history=0"),
    ]);
  });

  it("an open window takes the word Look Up names", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({ serendipity: SERENDIPITY });
    render(<DesktopDictionary defaultQuery="" />);
    act(() => {
      window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word: "serendipity" } }));
    });
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("serendipity");
    expect(
      await within(await entry("serendipity")).findByText(/unplanned, fortunate discovery/),
    ).toBeVisible();
  });

  it("a word whose look-up failed is asked for again when Look Up names it again", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const asked = serve({ serendipity: SERENDIPITY });
    const served = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    let down = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (down && url.includes("/api/dictionary/entry")) {
          asked.push("failed");
          return json(503, { error: "unavailable" });
        }
        return served(url);
      }),
    );
    render(<DesktopDictionary defaultQuery="" />);
    const lookUpAgain = () =>
      act(() => {
        window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word: "serendipity" } }));
      });
    lookUpAgain();
    expect(
      await within(await entry("serendipity")).findByText(/could not be reached. Try again/),
    ).toBeVisible();
    expect(asked).toEqual(["failed"]);

    // The same word again, once the dictionary answers: it is asked for, and its entry shown.
    down = false;
    lookUpAgain();
    expect(
      await within(await entry("serendipity")).findByText(/unplanned, fortunate discovery/),
    ).toBeVisible();
    expect(asked).toEqual(["failed", "serendipity"]);

    // Asked again, the entry already shown stays while the module answers.
    lookUpAgain();
    expect(
      await within(await entry("serendipity")).findByText(/unplanned, fortunate discovery/),
    ).toBeVisible();
    await waitFor(() => expect(asked).toEqual(["failed", "serendipity", "serendipity"]));
  });

  it("an answer with a source that failed is asked for again on the next Look Up", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    // Wikipedia could not be reached the first time; the rest of the entry came.
    const partial = { ...SERENDIPITY, wikipedia: null, failed: ["wikipedia"] };
    const entries: Record<string, unknown> = { serendipity: partial };
    const asked = serve(entries);
    render(<DesktopDictionary defaultQuery="" defaultScope="all" />);
    const lookUp = () =>
      act(() => {
        window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word: "serendipity" } }));
      });
    lookUp();
    const shown = within(await entry("serendipity"));
    expect(await shown.findByText(/unplanned, fortunate discovery/)).toBeVisible();
    expect(shown.queryByRole("link", { name: "Read More on Wikipedia" })).toBeNull();
    // Wikipedia answers now: the next Look Up asks again and shows it.
    entries.serendipity = SERENDIPITY;
    lookUp();
    expect(
      await within(await entry("serendipity")).findByRole("link", {
        name: "Read More on Wikipedia",
      }),
    ).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Serendipity");
    expect(asked).toEqual(["serendipity", "serendipity"]);
  });

  it("looking a word up again moves it to the front of the recent look-ups", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const asked = serve({ serendipity: SERENDIPITY, serene: { ...SERENDIPITY, word: "serene" } });
    const user = userEvent.setup();
    render(<DesktopDictionary defaultQuery="" defaultScope="all" />);
    const lookUp = (word: string) =>
      act(() => {
        window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word } }));
      });
    for (const word of ["serendipity", "serene", "serendipity"]) {
      lookUp(word);
      await within(await entry(word)).findByText(/unplanned, fortunate discovery/);
      await waitFor(() => expect(asked.at(-1)).toBe(word));
    }
    expect(asked).toEqual(["serendipity", "serene", "serendipity"]);
    await user.clear(screen.getByRole("searchbox", { name: "Search" }));
    const listed = within(screen.getByRole("listbox", { name: "Words" })).getAllByRole("option");
    expect(listed.map((option) => option.textContent)).toEqual(["serendipity", "serene"]);
  });

  it("a look-up made before the stored history arrives stays first", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({ serendipity: SERENDIPITY }, ["luck", "serendipity"]);
    const served = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    let release: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string) => {
      if (url.includes("/api/dictionary/history") && !release) {
        const answer = served(url);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return served(url);
    });
    const user = userEvent.setup();
    render(<DesktopDictionary defaultQuery="" defaultScope="all" />);
    act(() => {
      window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word: "serendipity" } }));
    });
    await within(await entry("serendipity")).findByText(/unplanned, fortunate discovery/);
    await act(async () => release?.());
    await user.clear(screen.getByRole("searchbox", { name: "Search" }));
    const listed = within(screen.getByRole("listbox", { name: "Words" })).getAllByRole("option");
    expect(listed.map((option) => option.textContent)).toEqual(["serendipity", "luck"]);
  });

  it("recent look-ups follow the order they were started, not the order they answered", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({ serendipity: SERENDIPITY, serene: { ...SERENDIPITY, word: "serene" } }, ["luck"]);
    const served = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    let release: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string) => {
      if (url.includes("word=serendipity") && !release) {
        const answer = served(url);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return served(url);
    });
    const user = userEvent.setup();
    render(<DesktopDictionary defaultQuery="" defaultScope="all" />);
    const lookUp = (word: string) =>
      act(() => {
        window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word } }));
      });
    lookUp("serendipity");
    await waitFor(() => expect(release).toBeDefined());
    lookUp("serene");
    await within(await entry("serene")).findByText(/unplanned, fortunate discovery/);
    await act(async () => release?.());
    await user.clear(screen.getByRole("searchbox", { name: "Search" }));
    await waitFor(() => {
      const listed = within(screen.getByRole("listbox", { name: "Words" })).getAllByRole("option");
      expect(listed.map((option) => option.textContent)).toEqual(["serene", "serendipity", "luck"]);
    });
  });

  it("a word asked again while its first look-up is on its way counts from the newer start", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({ serendipity: SERENDIPITY, serene: { ...SERENDIPITY, word: "serene" } }, ["luck"]);
    const served = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    let release: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string) => {
      if (url.includes("word=serendipity") && !release) {
        const answer = served(url);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return served(url);
    });
    const user = userEvent.setup();
    render(<DesktopDictionary defaultQuery="" defaultScope="all" />);
    const lookUp = (word: string) =>
      act(() => {
        window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word } }));
      });
    lookUp("serendipity");
    await waitFor(() => expect(release).toBeDefined());
    lookUp("serene");
    await within(await entry("serene")).findByText(/unplanned, fortunate discovery/);
    lookUp("serendipity");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 600)));
    await act(async () => release?.());
    await user.clear(screen.getByRole("searchbox", { name: "Search" }));
    await waitFor(() => {
      const listed = within(screen.getByRole("listbox", { name: "Words" })).getAllByRole("option");
      expect(listed.map((option) => option.textContent)).toEqual(["serendipity", "serene", "luck"]);
    });
  });

  it("Look Ups that come quickly one after another each reach the module", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const asked = serve({ serendipity: SERENDIPITY, serene: { ...SERENDIPITY, word: "serene" } });
    render(<DesktopDictionary defaultQuery="" defaultScope="all" />);
    act(() => {
      window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word: "serendipity" } }));
      window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word: "serene" } }));
    });
    await waitFor(() => expect(asked).toEqual(["serendipity", "serene"]));
  });

  it("choosing the word a typed search shows asks the module again", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const asked = serve({ serendipity: SERENDIPITY });
    const user = userEvent.setup();
    render(<DesktopDictionary defaultQuery="" defaultScope="all" />);
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "serendipity");
    await within(await entry("serendipity")).findByText(/unplanned, fortunate discovery/);
    await waitFor(() => expect(asked).toEqual(["serendipity"]));
    const words = screen.getByRole("listbox", { name: "Words" });
    await user.click(within(words).getByRole("option", { name: "serendipity" }));
    await waitFor(() => expect(asked).toEqual(["serendipity", "serendipity"]));
  });

  it("a Look Up that comes while a typed word waits drops the typed one", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const asked = serve({ serendipity: SERENDIPITY, serene: { ...SERENDIPITY, word: "serene" } });
    const user = userEvent.setup();
    render(<DesktopDictionary defaultQuery="" defaultScope="all" />);
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "serene");
    act(() => {
      window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word: "serendipity" } }));
    });
    await within(await entry("serendipity")).findByText(/unplanned, fortunate discovery/);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 700)));
    expect(asked, "the typed word is not asked for after the Look Up").toEqual(["serendipity"]);
  });

  it("only the newest look-up that answered says whether it was kept", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({
      serendipity: SERENDIPITY,
      serene: { ...SERENDIPITY, word: "serene", remembered: false },
    });
    const served = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    let release: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string) => {
      if (url.includes("word=serendipity") && !release) {
        const answer = served(url);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return served(url);
    });
    render(<DesktopDictionary defaultQuery="" defaultScope="all" />);
    const lookUp = (word: string) =>
      act(() => {
        window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word } }));
      });
    lookUp("serendipity");
    await waitFor(() => expect(release).toBeDefined());
    lookUp("serene");
    const warning =
      "“serene” was looked up but not kept in your recent look-ups. It is kept the next time it is looked up.";
    expect(await screen.findByText(warning)).toBeVisible();
    // The older look-up answers now, kept: the newer one's warning stays.
    await act(async () => release?.());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.getByText(warning)).toBeVisible();
  });

  it("a newer look-up that fails takes away an older look-up's warning", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve({ serene: { ...SERENDIPITY, word: "serene", remembered: false } });
    const served = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    vi.stubGlobal("fetch", (url: string) =>
      url.includes("word=serendipity")
        ? Promise.resolve(json(503, { error: "storage failed" }))
        : served(url),
    );
    render(<DesktopDictionary defaultQuery="" defaultScope="all" />);
    const lookUp = (word: string) =>
      act(() => {
        window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word } }));
      });
    lookUp("serene");
    const warning =
      "“serene” was looked up but not kept in your recent look-ups. It is kept the next time it is looked up.";
    expect(await screen.findByText(warning)).toBeVisible();
    lookUp("serendipity");
    expect(await screen.findByText(/could not be reached. Try again/)).toBeVisible();
    expect(screen.queryByText(warning)).toBeNull();
  });

  it("a newer look-up that fails is not replaced by an older one that answers later", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    serve({ serendipity: SERENDIPITY });
    const served = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    let entries = 0;
    let releaseFirst: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string) => {
      if (url.includes("word=serendipity")) {
        entries += 1;
        // The first look-up answers late, the second fails at once.
        if (entries === 1) {
          const answer = served(url);
          return new Promise((resolve) => {
            releaseFirst = () => resolve(answer);
          });
        }
        return Promise.resolve(json(503, { error: "storage failed" }));
      }
      return served(url);
    });
    render(<DesktopDictionary defaultQuery="" defaultScope="all" />);
    const lookUp = () =>
      act(() => {
        window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word: "serendipity" } }));
      });
    lookUp();
    await waitFor(() => expect(releaseFirst).toBeDefined());
    lookUp();
    expect(await screen.findByText(/could not be reached. Try again/)).toBeVisible();
    await act(async () => releaseFirst?.());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.getByText(/could not be reached. Try again/)).toBeVisible();
    expect(screen.queryByText(/unplanned, fortunate discovery/)).toBeNull();
    // The module kept the older look-up in the history, so it is listed among the recent ones.
    await user.clear(screen.getByRole("searchbox", { name: "Search" }));
    expect(
      within(screen.getByRole("listbox", { name: "Words" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["serendipity"]);
  });

  it("a look-up the module could not keep is not listed as recent, and says so", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const asked = serve({ serendipity: { ...SERENDIPITY, remembered: false } });
    const user = userEvent.setup();
    render(<DesktopDictionary defaultQuery="" defaultScope="all" />);
    act(() => {
      window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word: "serendipity" } }));
    });
    await within(await entry("serendipity")).findByText(/unplanned, fortunate discovery/);
    expect(
      await screen.findByText(
        "“serendipity” was looked up but not kept in your recent look-ups. It is kept the next time it is looked up.",
      ),
    ).toBeVisible();
    expect(asked).toEqual(["serendipity"]);
    await user.clear(screen.getByRole("searchbox", { name: "Search" }));
    expect(within(screen.getByRole("listbox", { name: "Words" })).queryAllByRole("option")).toEqual(
      [],
    );
  });

  it("looks up words that are also names of object properties", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const asked = serve({
      constructor: {
        ...SERENDIPITY,
        word: "constructor",
        dictionary: {
          parts: [
            { part: "noun", senses: [{ text: "A person who builds things.", examples: [] }] },
          ],
        },
        thesaurus: [],
        wikipedia: null,
      },
    });
    render(<DesktopDictionary defaultQuery="" />);
    const ask = (word: string) =>
      act(() => {
        window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word } }));
      });
    // Before its answer arrives, the word is "looking up", not an inherited function.
    ask("constructor");
    expect(
      await within(await entry("constructor")).findByText("A person who builds things."),
    ).toBeVisible();
    ask("toString");
    expect(await within(await entry("toString")).findByText(NOT_FOUND)).toBeVisible();
    expect(asked).toEqual(["constructor", "toString"]);
  });

  it("outside the Ferrite app it is the demo, opening on a word Look Up left", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    window.dispatchEvent(
      new CustomEvent(DESKTOP_EFFECTS_EVENT, { detail: [{ open: "dictionary" }] }),
    );
    render(<DesktopDictionary defaultQuery="computer" />);
    expect(screen.getByRole("region", { name: "Dictionary (32 found)" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Look Up in an open window keeps its scope and adds a step Back returns from", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<DesktopDictionary defaultQuery="computer" />);
    const source = (name: string) =>
      within(screen.getByRole("radiogroup", { name: "Source" })).getByRole("radio", { name });
    await user.click(source("All"));
    await user.click(screen.getByRole("button", { name: "Increase text size" }));
    act(() => {
      window.dispatchEvent(new CustomEvent(LOOK_UP_EVENT, { detail: { word: "dock" } }));
    });
    const field = screen.getByRole("searchbox", { name: "Search" });
    expect(field).toHaveValue("dock");
    // The window was not built again: the scope and the text size are the person's.
    expect(source("All")).toBeChecked();
    expect(screen.getByRole("button", { name: "Decrease text size" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(field).toHaveValue("computer");
  });
});
