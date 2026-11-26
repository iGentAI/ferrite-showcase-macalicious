import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setDesktopSession } from "../desktop/desktop-server";
import { deriveKey, WrongPasswordError } from "../keychain-access/keychain-access-vault";
import { matches, type NotesNote, type SealedNote, summarize } from "./notes-data";
import {
  createNotesLock,
  isClosed,
  type LockedText,
  openText,
  revealNote,
  sealText,
  WRONG_PASSWORD,
} from "./notes-lock";
import { mergeNotes } from "./notes-sync";

const KDF = {
  name: "PBKDF2-SHA-256" as const,
  iterations: 100_000,
  salt: "c2FsdHNhbHRzYWx0c2FsdA==",
};
const PIN: LockedText = { lines: ["Bank", "PIN 4411"], html: "<b>Bank</b><div>PIN 4411</div>" };
const keyOf = (password = "tide-pool") => deriveKey(password, KDF);

const sealedNote = async (
  text = PIN,
  rev = 1,
  password = "tide-pool",
  hint?: string,
): Promise<NotesNote> => ({
  id: "a",
  folder: "notes",
  lines: [],
  date: "9:00 AM",
  edited: "today",
  locked: true,
  sealed: { ...(await sealText("a", text, await keyOf(password), KDF, hint)), rev },
});

describe("a locked note's envelope", () => {
  it("opens with its key and holds none of the text in the clear", async () => {
    const key = await keyOf();
    const sealed = await sealText("a", PIN, key, KDF, "the beach");
    expect(sealed.kdf).toEqual(KDF);
    expect(sealed.hint).toBe("the beach");
    expect(JSON.stringify(sealed)).not.toContain("4411");
    expect(atob(sealed.ciphertext)).not.toContain("4411");
    expect(await openText("a", sealed, key)).toEqual(PIN);
  });

  it("doesn't open with another password, or as another note", async () => {
    const sealed = await sealText("a", PIN, await keyOf(), KDF);
    await expect(openText("a", sealed, await keyOf("wrong"))).rejects.toThrow(WrongPasswordError);
    await expect(openText("b", sealed, await keyOf())).rejects.toThrow(WrongPasswordError);
  });

  it("takes a fresh IV for each save", async () => {
    const key = await keyOf();
    const [one, two] = [await sealText("a", PIN, key, KDF), await sealText("a", PIN, key, KDF)];
    expect(one.iv).not.toBe(two.iv);
    expect(one.ciphertext).not.toBe(two.ciphertext);
  });
});

describe("what a window knows of a locked note", () => {
  it("lists it by no word of its text, and finds none", async () => {
    const note = await sealedNote();
    expect(summarize(note)).toEqual({ title: "Locked Note", snippet: "Locked" });
    expect(matches(note, "bank")).toBe(false);
    expect(matches(note, "4411")).toBe(false);
  });

  it("shows the text only while it is open", async () => {
    const note = await sealedNote();
    const closed = { open: new Map() };
    expect(isClosed(closed, note)).toBe(true);
    expect(revealNote(closed, note).lines).toEqual([]);
    const open = {
      open: new Map([
        ["a", { id: "a", text: PIN, date: "1 PM", edited: "now", refused: false, generation: 0 }],
      ]),
    };
    const shown = revealNote(open, note);
    expect(shown.lines).toEqual(["Bank", "PIN 4411"]);
    expect(shown.sealed).toBeUndefined();
    expect(shown.locked).toBeUndefined();
    expect(summarize(shown).title).toBe("Bank");
  });
});

describe("a change made here meeting a note locked elsewhere", () => {
  it("keeps no copy of what was typed, which would put the text back in the clear", async () => {
    const locked = await sealedNote();
    const folders = [{ id: "notes", name: "Notes" }];
    const plain = (lines: string[]): NotesNote => ({
      id: "a",
      folder: "notes",
      lines,
      date: "9:00 AM",
      edited: "today",
    });
    const merged = mergeNotes(
      { folders, notes: [plain(["Bank"])] },
      { folders, notes: [plain(["Bank", "PIN 4411"])] },
      { folders, notes: [locked] },
    );
    expect(merged.notes.map((note) => note.id)).toEqual(["a"]);
    expect(JSON.stringify(merged)).not.toContain("4411");
    expect(merged.notes[0]?.sealed).toEqual(locked.sealed);
  });

  it("keeps a pin made here on a note locked elsewhere", async () => {
    const locked = await sealedNote();
    const folders = [{ id: "notes", name: "Notes" }];
    const merged = mergeNotes(
      { folders, notes: [locked] },
      { folders, notes: [{ ...locked, pinned: true }] },
      { folders, notes: [locked] },
    );
    expect(merged.notes[0]?.pinned).toBe(true);
    expect(merged.notes[0]?.sealed).toEqual(locked.sealed);
  });
});

/** The desktop's server, as a stand-in: a document and the `/locked` route's one rule. */
function fakeServer(first: NotesNote) {
  const state = { note: first, rev: 5, puts: [] as string[] };
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/notes/data")) {
        return json(200, {
          rev: state.rev,
          data: { folders: [{ id: "notes", name: "Notes" }], notes: [state.note] },
        });
      }
      if (String(url).includes("/api/notes/locked") && init?.method === "PUT") {
        state.puts.push(String(init.body));
        const { changes } = JSON.parse(String(init.body)) as {
          changes: { id: string; rev: number; sealed: Omit<SealedNote, "rev"> }[];
        };
        const change = changes[0];
        if (!change || change.rev !== state.note.sealed?.rev) {
          return json(409, { error: "changed", rev: state.rev, refused: ["a"] });
        }
        state.note = { ...state.note, sealed: { ...change.sealed, rev: change.rev + 1 } };
        state.rev += 1;
        return json(200, { rev: state.rev, notes: { a: change.rev + 1 } });
      }
      return json(404, {});
    }),
  );
  return state;
}

describe("the page's lock", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    setDesktopSession(null);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    setDesktopSession(null);
  });

  const opened = async (options = {}) => {
    const server = fakeServer(await sealedNote(PIN, 1, "tide-pool", "the beach"));
    const lock = createNotesLock({ iterations: 100_000, ...options });
    expect(await lock.unlock("a", "tide-pool")).toEqual({ ok: true });
    return { lock, server };
  };

  it("refuses a wrong password, gives the hint, and opens nothing", async () => {
    fakeServer(await sealedNote(PIN, 1, "tide-pool", "the beach"));
    const lock = createNotesLock({ iterations: 100_000 });
    expect(await lock.unlock("a", "nope")).toEqual({
      ok: false,
      reason: WRONG_PASSWORD,
      hint: "the beach",
    });
    expect(lock.view().open.size).toBe(0);
    expect(lock.keyHeld()).toBe(false);
  });

  it("refuses a wrong password while the key is held", async () => {
    const { lock } = await opened();
    expect(await lock.unlock("a", "nope")).toEqual({
      ok: false,
      reason: WRONG_PASSWORD,
      hint: "the beach",
    });
    lock.closeAll();
  });

  it("saves an edit as ciphertext, naming the revision", async () => {
    const { lock, server } = await opened();
    expect(lock.view().open.get("a")?.text).toEqual(PIN);
    expect(lock.edit("a", ["Bank", "PIN 9090"], false, undefined, undefined)).toBe(true);
    await waitFor(() => expect(server.puts).toHaveLength(1));
    const sent = JSON.parse(server.puts[0] as string);
    expect(sent.changes[0].rev).toBe(1);
    expect(server.puts[0]).not.toContain("9090");
    await waitFor(() => expect(server.note.sealed?.rev).toBe(2));
    expect(await openText("a", server.note.sealed as SealedNote, await keyOf())).toEqual({
      lines: ["Bank", "PIN 9090"],
    });
    lock.closeAll();
  });

  it("refuses a late save: the stored note stays, the text stays here, and the note says so", async () => {
    const { lock, server } = await opened();
    // Another window saves first.
    server.note = await sealedNote({ lines: ["Replaced elsewhere"] }, 2);
    const stored = server.note.sealed;
    lock.edit("a", ["Typed here, late"], false, undefined, undefined);
    await waitFor(() => expect(lock.view().open.get("a")?.refused).toBe(true));
    expect(server.note.sealed).toBe(stored);
    expect(lock.view().open.get("a")?.text.lines).toEqual(["Typed here, late"]);
    // A refused note takes no more typing.
    lock.edit("a", ["More"], false, undefined, undefined);
    expect(lock.view().open.get("a")?.text.lines).toEqual(["Typed here, late"]);
    await lock.showLatest("a");
    expect(lock.view().open.get("a")).toMatchObject({
      refused: false,
      text: { lines: ["Replaced elsewhere"] },
    });
    lock.closeAll();
  });

  it("counts a save whose reply was lost as saved, not as a change made elsewhere", async () => {
    const { lock, server } = await opened();
    server.note = await sealedNote({ lines: ["Same words"] }, 2);
    lock.edit("a", ["Same words"], false, undefined, undefined);
    await waitFor(() => expect(server.puts).toHaveLength(1));
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(lock.view().open.get("a")?.refused).toBe(false);
    lock.closeAll();
  });

  it("forgets keys and text when the desktop names another session", async () => {
    setDesktopSession("chris");
    const { lock } = await opened();
    expect(lock.keyHeld()).toBe(true);
    setDesktopSession("martin");
    expect(lock.view().open.size).toBe(0);
    expect(lock.keyHeld()).toBe(false);
    expect(lock.edit("a", ["x"], false, undefined, undefined)).toBe(false);
  });

  it("keeps nothing an unlock finishes after the account changed", async () => {
    setDesktopSession("chris");
    fakeServer(await sealedNote());
    const lock = createNotesLock({ iterations: 100_000 });
    const late = lock.unlock("a", "tide-pool");
    setDesktopSession("martin");
    expect(await late).toMatchObject({ ok: false });
    expect(lock.view().open.size).toBe(0);
    expect(lock.keyHeld()).toBe(false);
  });

  it("closes after the idle wait and on Close All, sending what was typed first", async () => {
    const { lock, server } = await opened({ idleMs: 150 });
    lock.edit("a", ["Last words"], false, undefined, undefined);
    await waitFor(() => expect(lock.view().open.size).toBe(0), { timeout: 2_000 });
    expect(lock.keyHeld()).toBe(false);
    await waitFor(() => expect(server.note.sealed?.rev).toBe(2));
  });

  it("forgets everything when the last Notes window closes", async () => {
    const { lock } = await opened();
    const closeOne = lock.windowOpened();
    const closeTwo = lock.windowOpened();
    closeOne();
    expect(lock.keyHeld()).toBe(true);
    closeTwo();
    expect(lock.keyHeld()).toBe(false);
    expect(lock.view().open.size).toBe(0);
  });
});

describe("the pane of a locked note", () => {
  it("takes a password, and says what forgetting it means", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const { LockedNotePane } = await import("./notes-lock-views");
    fakeServer(await sealedNote(PIN, 1, "tide-pool", "the beach"));
    const user = userEvent.setup();
    render(<LockedNotePane noteId="a" />);
    const pane = screen.getByRole("form", { name: "Locked note" });
    expect(pane).toHaveTextContent("lost: no one can recover it");
    await user.type(
      screen.getByLabelText("Enter the notes password to view this note."),
      "nope{Enter}",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The password you entered is not correct. Password hint: the beach",
    );
    expect(pane).not.toHaveTextContent("4411");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
